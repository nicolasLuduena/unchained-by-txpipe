import "server-only";
import {
  BaseError,
  ContractFunctionRevertedError,
  createWalletClient,
  http,
  parseAbi,
  type Abi,
  type AbiParameter,
  type Account,
  type Address,
} from "viem";
import { handoffRegistryAbi, handoffTokenAbi } from "@/lib/abi";
import { chain, chainName, deployment, publicClient } from "@/lib/chain";
import { anvilAccount } from "./dev-keys";
import { fujiAccount } from "./fuji-keys";
import { REGISTRY_WRITES, ROLES, type JsonArg, type RegistryCall, type Role, type RoleAddresses, type SendResult } from "./roles";

// The registry calls into the token, so its errors and OpenZeppelin's can surface through a registry call.
const REVERT_ABI = [
  ...handoffRegistryAbi,
  ...handoffTokenAbi.filter((item) => item.type === "error"),
  ...parseAbi(["error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed)"]),
] as Abi;

function accountFor(role: Role): Account | null {
  return chainName === "local" ? anvilAccount(role) : fujiAccount(role);
}

export function roleAddresses(): RoleAddresses {
  return Object.fromEntries(ROLES.map((role) => [role, accountFor(role)?.address ?? null])) as RoleAddresses;
}

function coerce(param: AbiParameter, value: JsonArg): unknown {
  if (param.type.endsWith("[]")) {
    const item = { ...param, type: param.type.slice(0, -2) };
    return (value as JsonArg[]).map((entry) => coerce(item, entry));
  }
  if (param.type === "tuple") {
    const { components } = param as { components: readonly AbiParameter[] };
    const record = value as Record<string, JsonArg>;
    return Object.fromEntries(components.map((c) => [c.name, coerce(c, record[c.name as string])]));
  }
  return param.type.startsWith("uint") ? BigInt(value as string | number) : value;
}

function refusal(error: unknown): SendResult {
  const reverted = error instanceof BaseError ? error.walk((e) => e instanceof ContractFunctionRevertedError) : null;
  if (reverted instanceof ContractFunctionRevertedError) {
    const args = reverted.data?.args?.map(String).join(", ");
    return { ok: false, code: reverted.data?.errorName ?? reverted.signature ?? "Revert", detail: args || reverted.reason };
  }
  return { ok: false, code: "SendFailed", detail: error instanceof BaseError ? error.shortMessage : String(error) };
}

/** Simulates first, so a refused call comes back with its reason and spends no gas. */
export async function sendAs(role: Role, call: RegistryCall): Promise<SendResult> {
  if (!REGISTRY_WRITES.includes(call.fn)) return { ok: false, code: "CallNotAllowed", detail: String(call.fn) };
  // One bad key here stops every order for everyone, so the hosted demo does not offer it.
  if (call.fn === "repointVenue" && chainName === "fuji") return { ok: false, code: "CallNotAllowed", detail: String(call.fn) };
  const registry = deployment?.contracts?.HandoffRegistry;
  if (!registry) return { ok: false, code: "NoDeployment" };
  const account = accountFor(role);
  if (!account) return { ok: false, code: "KeyNotConfigured", detail: role };

  try {
    const fn = handoffRegistryAbi.find((item) => item.type === "function" && item.name === call.fn);
    const inputs = (fn as unknown as { inputs: readonly AbiParameter[] }).inputs;
    const args = inputs.map((input, i) => coerce(input, call.args[i]));
    const { request } = await publicClient.simulateContract({
      account,
      address: registry as Address,
      abi: REVERT_ABI,
      functionName: call.fn,
      args,
    });
    const wallet = createWalletClient({ account, chain, transport: http(process.env.NEXT_PUBLIC_RPC_URL) });
    const hash = await wallet.writeContract(request);
    const receipt = await publicClient.waitForTransactionReceipt({ hash, pollingInterval: 500 });
    if (receipt.status !== "success") return { ok: false, code: "TransactionReverted", hash };
    return { ok: true, hash, block: receipt.blockNumber.toString() };
  } catch (error) {
    return refusal(error);
  }
}
