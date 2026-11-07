// Shows the raw paymaster and bundler exchange for one sponsored build, with the key redacted. Sends no user operation.
import { PaymasterMode } from "@0xgasless/smart-account";
import { ROLE, fujiSmartAccount, ownerFromMnemonic, teamPaymasterUrl } from "./lib.ts";

const { url, redact } = teamPaymasterUrl();
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: any, init?: any) => {
  const res = await realFetch(input, init);
  const target = String(input?.url ?? input);
  if (target.includes("0xgasless.com")) {
    const method = init?.body ? JSON.parse(init.body).method : "?";
    const text = await res.clone().text();
    console.log(`[${res.status}] ${method} -> ${redact(text).slice(0, 500)}`);
    if (process.env.DIAG_SHOW_OP && method === "pm_sponsorUserOperation") console.log(redact(init.body).slice(0, 1500));
  }
  return res;
}) as typeof fetch;

const account = await fujiSmartAccount(ownerFromMnemonic(ROLE.sellerOwner), { paymasterUrl: url });
const address = (await account.getAccountAddress()) as `0x${string}`;
const tx = { to: address, data: "0x" as const, value: 0n };

for (const [label, data] of [
  ["default", { mode: PaymasterMode.SPONSORED }],
  ["calculateGasLimits=false", { mode: PaymasterMode.SPONSORED, calculateGasLimits: false }],
] as const) {
  console.log(`--- ${label}`);
  try {
    const op = await account.buildUserOp([tx], { paymasterServiceData: data });
    console.log(`signed paymasterAndData bytes: ${((op.paymasterAndData as string).length - 2) / 2}`);
  } catch (error) {
    console.log(`threw: ${redact(String((error as Error).message)).slice(0, 300)}`);
  }
}

// Explicit gas limits, so the paymaster does not have to estimate an op the account cannot prefund.
console.log("--- explicit gas limits, calculateGasLimits=false");
const fees = await (account as any).bundler.getGasFeeValues();
const explicit = {
  sender: address, nonce: "0x0", initCode: await account.getInitCode(), callData: await account.encodeExecute(address, 0n, "0x"),
  signature: await account.getDummySignatures(), paymasterAndData: "0x", maxFeePerGas: fees.maxFeePerGas, maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  callGasLimit: "0x30d40", verificationGasLimit: "0x7a120", preVerificationGas: "0x186a0",
};
try {
  const out = await (account as any).paymaster.getPaymasterAndData(explicit, { mode: PaymasterMode.SPONSORED, calculateGasLimits: false });
  console.log(`signed paymasterAndData bytes: ${(out.paymasterAndData.length - 2) / 2}`);
} catch (error) {
  console.log(`threw: ${redact(String((error as Error).message)).slice(0, 300)}`);
}

// Control: the same request on a key that cannot exist, to tell a bad key from a server fault.
console.log("--- control: placeholder key");
const control = await realFetch("https://paymaster.0xgasless.com/v1/43113/rpc/not-a-real-key", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "pm_sponsorUserOperation", params: [explicit, { mode: "SPONSORED", calculateGasLimits: false }] }),
});
console.log(`[${control.status}] ${(await control.text()).slice(0, 300)}`);
