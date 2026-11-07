import { erc20Abi, type Address } from "viem";
import { handoffRegistryAbi } from "@/lib/abi";
import { deployment, publicClient } from "@/lib/chain";
import { feedFromLogs, feedFromVenue, openOrders, type FeedEntry } from "./feed";
import { categoryIn, kumply, type Category } from "./kumply";
import type { LogScanner, ScannedLog } from "./scan";
import { ROLES, type Role, type RoleAddresses } from "./roles";
import { shortAddress } from "./format";

export type HolderState = "Verificado" | "Bloqueado" | "Revertido" | "Sin atestación" | "Sin unidades";

export type HolderRow = { address: Address; category: Category; units: bigint; state: HolderState; blocked: boolean };

export type TokenView = {
  address: Address;
  name: string;
  symbol: string;
  issuer: Address;
  depositRef: string;
  cnvAuthRef: string;
  issuanceDocHash: string;
  authorizedSupply: bigint;
  totalSupply: bigint;
  tradingEnabled: boolean;
  paused: boolean;
  floor: bigint;
  band: { price: bigint; widthBps: number; maxAge: bigint };
  venues: { venue: Address; orderKey: Address }[];
  attesters: readonly Address[];
  holders: HolderRow[];
  openOrders: number;
};

/** null means the SDK read failed, and the console fails closed. */
export type BusinessRead = Record<Role, boolean | null>;

export type ConsoleState = {
  head: bigint;
  scannedTo: bigint;
  tokens: TokenView[];
  feed: FeedEntry[];
  business: BusinessRead;
  venueRouteUp: boolean;
};

const registry = () => deployment?.contracts?.HandoffRegistry as Address;
const read = <T>(functionName: string, args: unknown[]) =>
  publicClient.readContract({ address: registry(), abi: handoffRegistryAbi, functionName, args } as never) as Promise<T>;
const readErc20 = <T>(address: Address, functionName: "name" | "symbol" | "totalSupply") =>
  publicClient.readContract({ address, abi: erc20Abi, functionName }) as Promise<T>;

function balancesFrom(transfers: readonly ScannedLog[]): Map<Address, bigint> {
  const balances = new Map<Address, bigint>();
  const add = (holder: Address, delta: bigint) => balances.set(holder, (balances.get(holder) ?? 0n) + delta);
  const zero = "0x0000000000000000000000000000000000000000";
  for (const { args } of transfers) {
    const { from, to, value } = args as { from: Address; to: Address; value: bigint };
    if (from !== zero) add(from, -value);
    if (to !== zero) add(to, value);
  }
  return balances;
}

function holderState(units: bigint, blocked: boolean, attested: boolean, reverted: boolean): HolderState {
  if (blocked) return "Bloqueado";
  if (units === 0n) return reverted ? "Revertido" : "Sin unidades";
  return attested ? "Verificado" : "Sin atestación";
}

async function readHolders(token: Address, attesters: readonly Address[], scanner: LogScanner): Promise<HolderRow[]> {
  const reverted = new Set(
    scanner.feedLogs.filter((l) => l.eventName === "Reversion" && l.args.token === token).map((l) => l.args.holder as Address),
  );
  const balances = balancesFrom(scanner.transfers.get(token) ?? []);
  const rows = await Promise.all(
    [...balances].map(async ([address, units]) => {
      const [blocked, attested, category] = await Promise.all([
        read<boolean>("isBlocked", [token, address]),
        read<boolean>("isAttested", [token, address]),
        categoryIn(attesters, address),
      ]);
      return { address, category, units, blocked, state: holderState(units, blocked, attested, reverted.has(address)) };
    }),
  );
  return rows.sort((a, b) => (a.units === b.units ? 0 : a.units > b.units ? -1 : 1));
}

async function readToken(address: Address, scanner: LogScanner): Promise<TokenView> {
  const [name, symbol, totalSupply, info, band, venues, attesters] = await Promise.all([
    readErc20<string>(address, "name"),
    readErc20<string>(address, "symbol"),
    readErc20<bigint>(address, "totalSupply"),
    read<Omit<TokenView, "address" | "name" | "symbol" | "totalSupply" | "band" | "venues" | "attesters" | "holders" | "openOrders">>("tokenInfo", [address]),
    read<TokenView["band"]>("band", [address]),
    read<readonly Address[]>("venues", [address]),
    read<readonly Address[]>("attesters", [address]),
  ]);
  const keyed = await Promise.all(venues.map(async (venue) => ({ venue, orderKey: await read<Address>("venueKey", [address, venue]) })));
  return {
    ...info,
    address,
    name,
    symbol,
    totalSupply,
    band,
    venues: keyed,
    attesters,
    holders: await readHolders(address, attesters, scanner),
    openOrders: openOrders(scanner.feedLogs, address, Math.floor(Date.now() / 1000)),
  };
}

async function readBusiness(roles: RoleAddresses): Promise<BusinessRead> {
  const store = await read<Address>("issuerAttester", []);
  const entries = await Promise.all(
    ROLES.map(async (role) => {
      const address = roles[role];
      if (!address) return [role, null] as const;
      return [role, await kumply(store).isBusiness(address).catch(() => null)] as const;
    }),
  );
  return Object.fromEntries(entries) as BusinessRead;
}

/** The order service may not exist yet. Absence is a normal state here, not an error. */
async function readVenueRefusals(): Promise<unknown | null> {
  try {
    const response = await fetch("/api/venue/refusals", { cache: "no-store" });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

/** One poll: advance the log cursors, then rebuild everything the screen shows from chain reads. */
export async function readConsole(scanner: LogScanner, roles: RoleAddresses): Promise<ConsoleState> {
  const head = await publicClient.getBlockNumber();
  const count = await read<bigint>("tokenCount", []);
  const addresses = await Promise.all(Array.from({ length: Number(count) }, (_, i) => read<Address>("tokenAt", [BigInt(i)])));
  const contracts = [deployment?.contracts?.HandoffRegistry, deployment?.contracts?.HandoffSettlement].filter(Boolean) as Address[];
  await scanner.poll(head, contracts, addresses);

  const [tokens, business, venue] = await Promise.all([
    Promise.all(addresses.map((address) => readToken(address, scanner))),
    readBusiness(roles),
    readVenueRefusals(),
  ]);
  const names = new Map(tokens.map((t) => [t.address.toLowerCase(), t.name]));
  const assetName = (token: Address) => names.get(String(token).toLowerCase()) ?? shortAddress(String(token));
  return {
    head,
    scannedTo: scanner.scannedTo(),
    tokens,
    business,
    venueRouteUp: venue !== null,
    feed: [...feedFromLogs(scanner.feedLogs, (block) => scanner.timeOf(block), assetName), ...feedFromVenue(venue, assetName)],
  };
}
