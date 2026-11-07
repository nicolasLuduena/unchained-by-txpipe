// Calls verify() on the KUMPLY Fuji store and through @kumply/sdk. Read-only, needs no credentials.
// Usage: npm run check-attestations [-- 0xAddress ...]. With no arguments it checks the demo set from MNEMONIC_PATH.
import { DEPLOYMENTS, KumplyClient } from "@kumply/sdk";
import { createPublicClient, http, keccak256, parseAbi, toBytes } from "viem";
import { avalancheFuji } from "viem/chains";
import { FUJI, ROLE, fujiSmartAccount, ownerFromMnemonic } from "./lib.ts";

const pub = createPublicClient({ chain: avalancheFuji, transport: http(FUJI.rpcUrl) });
const abi = parseAbi([
  "function verify(address) view returns (bool verified, uint32 tier, uint64 timestamp, uint64 expiry)",
  "function hasRole(bytes32, address) view returns (bool)",
  "function totalAttestations() view returns (uint256)",
]);
const kumply = new KumplyClient({ network: "fuji", contractAddress: DEPLOYMENTS.fuji.attestationStore, rpcUrl: FUJI.rpcUrl });

type Target = { role: string; address: `0x${string}`; tier?: number };
const args = process.argv.slice(2).filter((a) => a.startsWith("0x")) as `0x${string}`[];
const targets: Target[] = args.length
  ? args.map((address) => ({ role: "argument", address }))
  : [
      { role: "seller account", address: (await (await fujiSmartAccount(ownerFromMnemonic(ROLE.sellerOwner))).getAccountAddress()) as `0x${string}`, tier: 2 },
      { role: "buyer account", address: (await (await fujiSmartAccount(ownerFromMnemonic(ROLE.buyerOwner))).getAccountAddress()) as `0x${string}`, tier: 2 },
      { role: "issuer", address: ownerFromMnemonic(ROLE.issuer).address, tier: 4 },
      { role: "unverified EOA", address: ownerFromMnemonic(ROLE.unverified).address, tier: 0 },
    ];

const verifier = process.env.KUMPLY_VERIFIER ?? "0xD65042534CE80fcb641fd6Eb99a16eBF6C0cd076";
const isVerifier = await pub.readContract({ address: FUJI.kumplyStore, abi, functionName: "hasRole", args: [keccak256(toBytes("VERIFIER_ROLE")), verifier as `0x${string}`] });
console.log(`store ${FUJI.kumplyStore}  total issued ${await pub.readContract({ address: FUJI.kumplyStore, abi, functionName: "totalAttestations" })}`);
console.log(`verifier ${verifier} holds VERIFIER_ROLE: ${isVerifier}`);

let failed = 0;
for (const t of targets) {
  const [verified, tier, , expiry] = await pub.readContract({ address: FUJI.kumplyStore, abi, functionName: "verify", args: [t.address] });
  const person = await kumply.isPersonAtLeast(t.address, 2);
  const business = await kumply.isBusiness(t.address);
  const ok = t.tier === undefined || (t.tier === 0 ? !verified : verified && tier === t.tier);
  if (!ok) failed++;
  const expires = verified ? new Date(Number(expiry) * 1000).toISOString().slice(0, 10) : "-";
  console.log(`${ok ? "ok  " : "MISS"} ${t.role.padEnd(15)} ${t.address} verified=${verified} tier=${tier} expires=${expires} person>=2=${person} business=${business}${t.tier === undefined ? "" : ` expected tier ${t.tier}`}`);
}
process.exit(failed ? 1 : 0);
