// Captures what sendTransaction([approve, fill], SPONSORED) puts on the wire, against a local mock bundler and
// paymaster. Proves the SDK call shape only; it says nothing about the real paymaster accepting the op.
import { createServer } from "node:http";
import { PaymasterMode } from "@0xgasless/smart-account";
import { decodeFunctionData, encodeFunctionData, parseAbi, slice } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { FUJI, fujiSmartAccount } from "./lib.ts";

const seen: { method: string; params: any[] }[] = [];
const server = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const { id, method, params } = JSON.parse(body);
    seen.push({ method, params });
    const result =
      method === "skandha_getGasPrice" ? { maxFeePerGas: "0x59682f14", maxPriorityFeePerGas: "0x59682f00" }
      : method === "pm_sponsorUserOperation" ? { paymasterAndData: `${FUJI.verifyingPaymaster}${"00".repeat(97)}`, callGasLimit: "0x30d40", verificationGasLimit: "0x7a120", preVerificationGas: "0x186a0" }
      : method === "eth_sendUserOperation" ? `0x${"ab".repeat(32)}`
      : null;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ jsonrpc: "2.0", id, result }));
  });
});
await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));

const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
const account = await fujiSmartAccount(privateKeyToAccount(generatePrivateKey()), { bundlerUrl: `${base}/43113`, paymasterUrl: `${base}/v1/43113/rpc/mock` });
const settlement = "0x000000000000000000000000000000000000dEaD";
const approve = encodeFunctionData({ abi: parseAbi(["function approve(address,uint256)"]), functionName: "approve", args: [settlement, 5_000_000n] });
const fill = "0xdeadbeef" as const;

const res = await account.sendTransaction(
  [{ to: FUJI.usdc, data: approve, value: 0n }, { to: settlement, data: fill, value: 0n }],
  { paymasterServiceData: { mode: PaymasterMode.SPONSORED } },
);
const sent = seen.filter((s) => s.method === "eth_sendUserOperation");
const op = sent[0].params[0];
const batchAbi = parseAbi(["function executeBatch_y6U(address[] dest, uint256[] value, bytes[] func)"]);
const decoded = decodeFunctionData({ abi: batchAbi, data: op.callData });
console.log("rpc sequence         ", seen.map((s) => s.method).join(", "));
console.log("user operations sent ", sent.length);
console.log("userOpHash           ", res.userOpHash);
console.log("callData selector    ", slice(op.callData, 0, 4), decoded.functionName);
console.log("targets              ", decoded.args[0].join(", "));
console.log("paymaster mode       ", seen.find((s) => s.method === "pm_sponsorUserOperation")?.params[1].mode);
console.log("paymasterAndData     ", `${op.paymasterAndData.slice(0, 42)}...`);
server.close();
process.exit(0);
