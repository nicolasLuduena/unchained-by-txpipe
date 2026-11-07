// Prints every demo address with its Fuji balances. Read-only. Never prints the mnemonic or a key.
import { createPublicClient, formatEther, formatUnits, http, parseAbi } from "viem";
import { avalancheFuji } from "viem/chains";
import { FUJI, ROLE, fujiSmartAccount, ownerFromMnemonic } from "./lib.ts";

const pub = createPublicClient({ chain: avalancheFuji, transport: http(FUJI.rpcUrl) });
const erc20 = parseAbi(["function balanceOf(address) view returns (uint256)"]);

async function row(role: string, address: `0x${string}`) {
  const [avax, usdc, code] = await Promise.all([
    pub.getBalance({ address }),
    pub.readContract({ address: FUJI.usdc, abi: erc20, functionName: "balanceOf", args: [address] }),
    pub.getCode({ address }),
  ]);
  console.log(`${role.padEnd(22)} ${address}  AVAX ${formatEther(avax)}  USDC ${formatUnits(usdc, 6)}  ${code ? "deployed" : "no code"}`);
}

for (const [role, index] of Object.entries(ROLE)) {
  const owner = ownerFromMnemonic(index);
  await row(`${index} ${role}`, owner.address);
  if (role === "sellerOwner" || role === "buyerOwner") {
    await row(`  ${role} account`, (await (await fujiSmartAccount(owner)).getAccountAddress()) as `0x${string}`);
  }
}
