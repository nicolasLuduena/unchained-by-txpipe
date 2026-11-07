import "server-only";
import { encodeFunctionData, erc20Abi, parseAbi, verifyMessage, type Address, type Hash, type Hex } from "viem";
import { handoffRegistryAbi } from "@/lib/abi";
import { chain, chainName, publicClient } from "@/lib/chain";
import { venueKv } from "@/lib/orders/kv";
import { parseAddress, Refused } from "@/lib/orders/service";
import { accountContracts, bundlerUrl, ownedAccount, requireConfig, sendSponsored, teamWallet, withPaymaster } from "@/lib/sponsor/fuji-server";
import { passesPrecheck } from "@/lib/wallet/precheck";
import { revertReason } from "@/lib/wallet/revert-reason";
import { scopedKey } from "./limits";
import { onboardMessage, type AccountView, type OnboardRecord } from "./types";

const MAX_ONBOARDINGS = 20;
const DEMO_TIER = 2;
const ATTESTATION_LIFETIME_S = 365 * 86_400;
const DEMO_UNITS = 5n;
const DEMO_USDC = 5_000_000n;
const DEPLOYER_INDEX = 0;
const ISSUER_INDEX = 1;
const RECEIPT_POLL_MS = 1000;
/** Covers the slowest run seen plus a bundler wait. The route's maxDuration has to stay above TTL plus wait. */
const LOCK_TTL_MS = 120_000;
const LOCK_WAIT_MS = 50_000;
const LOCK_POLL_MS = 500;

const attestationAbi = parseAbi(["function issueAttestation(address subject, uint32 tier, uint64 expiry)"]);

const recordsKey = () => scopedKey("onboard");

async function readRecord(owner: Address): Promise<OnboardRecord | null> {
  const raw = await venueKv().hget(recordsKey(), owner);
  return raw ? (JSON.parse(raw) as OnboardRecord) : null;
}

function saveRecord(record: OnboardRecord) {
  return venueKv().hset(recordsKey(), record.owner, JSON.stringify(record));
}

function assertOnFuji() {
  if (chainName === "local") throw new Refused("not_on_local", "My wallet works only on Fuji.", 404);
}

/** The address, the contracts and how far this owner got. Reads only. */
export async function accountView(rawOwner: unknown): Promise<AccountView> {
  assertOnFuji();
  const owner = parseAddress(rawOwner, "owner");
  const [{ address: smartAccount }, record] = await Promise.all([ownedAccount(owner), readRecord(owner)]);
  return { owner, smartAccount, contracts: accountContracts(), bundlerUrl: bundlerUrl(), record };
}

/** One at a time across instances: the deployer, the issuer and the seller account each have one nonce. */
async function serialized<T>(work: () => Promise<T>): Promise<T> {
  const kv = venueKv();
  const lock = scopedKey("lock:onboard");
  const token = crypto.randomUUID();
  const deadline = Date.now() + LOCK_WAIT_MS;
  while (!(await kv.acquire(lock, token, LOCK_TTL_MS))) {
    if (Date.now() > deadline) throw new Refused("onboard_busy", "Other verifications are in progress. Try again in a moment.", 503);
    await new Promise((resolve) => setTimeout(resolve, LOCK_POLL_MS));
  }
  try {
    return await work();
  } finally {
    await kv.release(lock, token);
  }
}

async function confirmed(hash: Hash): Promise<Hash> {
  const receipt = await publicClient.waitForTransactionReceipt({ hash, pollingInterval: RECEIPT_POLL_MS });
  if (receipt.status !== "success") throw new Error(`Transaction reverted: ${hash}`);
  return hash;
}

/** A failure here is not fatal: the browser's first sponsored operation carries the initCode and deploys the account. */
async function deploy(initCode: Hex): Promise<Hash | undefined> {
  const { factoryAddress } = accountContracts();
  try {
    // initCode is the factory address and then its calldata, so this is the SDK's own deployment, paid by the deployer.
    const data = `0x${initCode.slice(42)}` as Hex;
    return await confirmed(await teamWallet(DEPLOYER_INDEX).sendTransaction({ to: factoryAddress as Address, data }));
  } catch (error) {
    console.error("onboard: deployer could not deploy, leaving it to the first sponsored operation", revertReason(error));
    return undefined;
  }
}

async function run(record: OnboardRecord, initCode: Hex): Promise<OnboardRecord> {
  const config = requireConfig();
  const { smartAccount } = record;
  let current = record;
  const step = async (change: Partial<OnboardRecord>) => {
    current = { ...current, ...change };
    await saveRecord(current);
  };

  if (initCode !== "0x" && !current.deployTx) await step({ deployTx: await deploy(initCode) });

  if (!(await passesPrecheck(config.attestationStore, smartAccount))) {
    const expiry = BigInt(Math.floor(Date.now() / 1000) + ATTESTATION_LIFETIME_S);
    const data = encodeFunctionData({ abi: attestationAbi, functionName: "issueAttestation", args: [smartAccount, DEMO_TIER, expiry] });
    await step({ attestTx: await confirmed(await teamWallet(DEPLOYER_INDEX).sendTransaction({ to: config.attestationStore, data })) });
  }

  if (!current.mintTx) {
    const data = encodeFunctionData({ abi: handoffRegistryAbi, functionName: "mint", args: [config.token, smartAccount, DEMO_UNITS] });
    await step({ mintTx: await confirmed(await teamWallet(ISSUER_INDEX).sendTransaction({ to: config.registry, data })) });
  }

  if (!current.usdcTx && !current.usdcSkipped) {
    const held = await publicClient.readContract({ address: config.usdc, abi: erc20Abi, functionName: "balanceOf", args: [config.seller] });
    if (held < DEMO_USDC) {
      await step({ usdcSkipped: true });
    } else {
      const data = encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [smartAccount, DEMO_USDC] });
      const { hash } = await withPaymaster((paymasterUrl) => sendSponsored("seller", [{ to: config.usdc, data }], paymasterUrl));
      await step({ usdcTx: hash });
    }
  }

  await step({ done: true });
  return current;
}

/**
 * Demo verification, with no identity check. Proves the caller owns the EOA, then deploys its smart account,
 * attests it, mints demo units and shares demo USDC. Idempotent per owner, and capped across all owners.
 */
export async function onboard(body: { owner?: unknown; signature?: unknown }): Promise<{ record: OnboardRecord }> {
  assertOnFuji();
  const owner = parseAddress(body.owner, "owner");
  const context = { address: owner };
  const { signature } = body;
  const signed =
    typeof signature === "string" &&
    (await verifyMessage({ address: owner, message: onboardMessage(owner, chain.id), signature: signature as Hex }).catch(() => false));
  if (!signed) throw new Refused("invalid_owner_signature", "The signature does not match this account.", 403, context);

  return serialized(async () => {
    const existing = await readRecord(owner);
    if (existing?.done) return { record: existing };
    if (!existing && Object.keys(await venueKv().hgetall(recordsKey())).length >= MAX_ONBOARDINGS) {
      throw new Refused("onboard_cap", "This demo has no places left.", 429, context);
    }

    try {
      const { address: smartAccount, initCode } = await ownedAccount(owner);
      const record = existing ?? { owner, smartAccount, done: false };
      await saveRecord(record);
      return { record: await run(record, initCode) };
    } catch (error) {
      if (error instanceof Refused) throw error;
      throw new Refused("onboard_failed", `We could not finish the demo verification: ${revertReason(error)}. Try again.`, 502, context);
    }
  });
}
