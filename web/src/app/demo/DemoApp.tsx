"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { isAddressEqual, type Address } from "viem";
import { Button, Hash, Notice, OperatedBy, Stamp, Tabs, type StampStatus } from "@/design";
import { parseBig } from "@/lib/big-json";
import { chainName, explorerUrl, networkLabel } from "@/lib/chain";
import { feedFromOrders, mergeFeed, type FeedEntry } from "@/lib/console/feed";
import type { ConsoleState } from "@/lib/console/state";
import type { OrderStatus, OrderView } from "@/lib/orders/types";
import { venueLabel, VENUES } from "@/lib/orders/venues";
import type { DirectResult } from "@/lib/sponsor/direct";
import { walletConfig, type WalletConfig } from "@/lib/wallet/deployment";
import { formatUsdc, tokensLabel } from "@/lib/wallet/format";
import { MarketSection } from "../_wallet/MarketSection";
import { FillProof, OrderCoupon } from "../_wallet/OrderCoupon";
import { SellSection } from "../_wallet/SellSection";
import { useAction, useWallet, type Precheck, type Wallet } from "../_wallet/useWallet";
import { ComplianceFeed } from "../console/ComplianceFeed";
import { attemptUnverified } from "./actions";
import { Guide } from "./Guide";
import { useBook, type Book } from "./useBook";

const FEED_POLL_MS = chainName === "local" ? 3000 : 15_000;
const CAVEAT = "Demo attestations on Fuji, no identity verification.";
const STORE_NOTE =
  chainName === "local"
    ? "Local network: the KUMPLY SDK reads a test stub."
    : "Demo instance of KUMPLY's contract. Not KUMPLY's official store.";

const HOST_STAMP: Record<Precheck, StampStatus> = { checking: "pending", passed: "verified", blocked: "blocked", unavailable: "pending" };
const BOOK_STAMP: Record<OrderStatus, { status: StampStatus; word: string }> = {
  open: { status: "unused", word: "Open" },
  filled: { status: "sold", word: "Sold" },
  cancelled: { status: "cancelled", word: "Cancelled" },
  expired: { status: "cancelled", word: "Expired" },
};

const couponNumber = (view: OrderView) => `No. ${(BigInt(view.order.nonce) % 10_000n).toString().padStart(4, "0")}`;

/** Oldest first, the order the market takes them in. */
function firstOpen(orders: OrderView[]) {
  return orders.findLast((o) => o.status === "open");
}

/** The shared set, the same rows on both phones. */
function BookStrip({ book }: { book: Book }) {
  return (
    <section className="demo-book" aria-label="Shared order book">
      <h3 className="t-field-label">Order book shared by both wallets</h3>
      <p className="caveat">Each order is co-signed by its own venue, not the buyer's.</p>
      {book.orders.length === 0 ? (
        <p className="caveat">{book.loaded ? "No orders yet." : "Reading the book."}</p>
      ) : (
        <ol className="demo-book__rows">
          {book.orders.map((view) => {
            const { status, word } = BOOK_STAMP[view.status];
            return (
              <li key={view.orderHash}>
                <span className="demo-book__no">{couponNumber(view)}</span>
                <span>{tokensLabel(BigInt(view.order.amount))}</span>
                <span>USDC {formatUsdc(BigInt(view.order.price))}</span>
                <span className="demo-book__venue">{venueLabel(view.order.venue)}</span>
                <Stamp status={status}>{word}</Stamp>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function Phone(props: { brand: string; role: string; venueName: string; wallet: Wallet; book: Book; children: ReactNode; nav?: ReactNode; view?: string }) {
  const { brand, role, venueName, wallet, book, children, nav, view } = props;
  return (
    <article className="host demo-phone" aria-label={brand}>
      <header className="host__bar">
        <span className="host__name">{brand}</span>
        <Stamp status={HOST_STAMP[wallet.precheck]} />
      </header>
      <div className="demo-phone__who">
        <span className="t-field-label">{role}</span>
        <span className="t-field-label">Operated by {venueName}</span>
        <Hash value={wallet.address} href={explorerUrl("address", wallet.address)} />
      </div>
      {nav}
      <main className="host__main demo-phone__body" key={view}>
        {wallet.offline && <Notice status="pending">Could not read {networkLabel}. Retrying.</Notice>}
        {children}
      </main>
      <BookStrip book={book} />
      <footer className="host__foot demo-phone__foot">
        <OperatedBy />
      </footer>
    </article>
  );
}

type SellerTab = "sell" | "orders";

function SellerPhone({ config, wallet, book }: { config: WalletConfig; wallet: Wallet; book: Book }) {
  const [tab, setTab] = useState<SellerTab>("sell");
  const mine = useMemo(() => book.orders.filter((o) => isAddressEqual(o.order.seller, wallet.address)), [book.orders, wallet.address]);
  const known = useRef<number | null>(null);

  // A posted order takes the seller to its coupon, so the tear happens on screen.
  useEffect(() => {
    if (!book.loaded) return;
    if (known.current !== null && mine.length > known.current) setTab("orders");
    known.current = mine.length;
  }, [book.loaded, mine.length]);

  function navigate(event: MouseEvent<HTMLDivElement>) {
    const target = (event.target as HTMLElement).closest("a")?.getAttribute("href");
    if (!target) return;
    event.preventDefault();
    setTab(target.slice(1) as SellerTab);
  }

  const nav = (
    <div onClick={navigate}>
      <Tabs
        ariaLabel="Billetera Sur sections"
        items={[
          { label: "Sell", href: "#sell", current: tab === "sell" },
          { label: "Your orders", href: "#orders", current: tab === "orders" },
        ]}
      />
    </div>
  );

  return (
    <Phone brand="Billetera Sur" role="Seller" venueName={VENUES[0]?.label ?? "PSAV 1"} wallet={wallet} book={book} nav={nav} view={tab}>
      {tab === "sell" ? (
        <SellSection config={config} actor="seller" wallet={wallet} />
      ) : (
        <section className="wallet-stack">
          <h2 className="t-title">Your orders</h2>
          {mine.length === 0 && <p className="caveat">You have no orders yet.</p>}
          {mine.map((view) => (
            <div className="wallet-stack" key={view.orderHash}>
              <OrderCoupon
                view={view}
                label="Sell order"
                tokenName={wallet.snapshot?.tokenName ?? "Token"}
                torn={book.torn.has(view.orderHash)}
                note={view.status === "open" ? `Published by ${venueLabel(view.order.venue)}. Your tokens stay in your wallet.` : undefined}
              />
              {view.status === "filled" && <FillProof view={view} />}
            </div>
          ))}
        </section>
      )}
    </Phone>
  );
}

function BuyerPhone({ config, wallet, book }: { config: WalletConfig; wallet: Wallet; book: Book }) {
  return (
    <Phone brand="Banco Norte" role="Buyer" venueName={VENUES[1]?.label ?? "PSAV 2"} wallet={wallet} book={book}>
      <MarketSection config={config} actor="buyer" wallet={wallet} />
    </Phone>
  );
}

/** The refusal, on demand: an account with no attestation calls the chain itself and pays its own gas. */
function UnverifiedControl({ config, order, onResult }: { config: WalletConfig; order: OrderView | undefined; onResult: (result: DirectResult) => void }) {
  const [attempt, setAttempt] = useState<DirectResult | null>(null);
  const action = useAction();

  function run(view: OrderView) {
    return action.run(async () => {
      const result = await attemptUnverified(config, view);
      setAttempt(result);
      onResult(result);
    });
  }

  return (
    <section className="demo-panel" aria-label="Unverified account">
      <div className="demo-panel__head">
        <span className="t-field-label">Unverified account</span>
        <Hash value={config.unverified} href={explorerUrl("address", config.unverified)} />
      </div>
      <p className="caveat">Skips the wallet and calls the contract, paying its own gas.</p>
      <Button variant="secondary" size="sm" busy={action.busy} disabled={!order} onClick={() => order && run(order)}>
        Try a direct purchase
      </Button>
      {!order && <p className="caveat">This needs an open order.</p>}
      {action.error && (
        <Notice status="blocked" word="Not sent">
          {action.error}
        </Notice>
      )}
      {attempt && (
        <div className="demo-panel__result">
          <Stamp status={attempt.reverted ? "reverted" : "sold"}>{attempt.reverted ? "Refused" : "Not reverted"}</Stamp>
          {attempt.reverted && <p className="caveat">The contract refused the purchase: {attempt.reason}</p>}
          <Hash value={attempt.hash} href={explorerUrl("tx", attempt.hash)} />
        </div>
      )}
    </section>
  );
}

function LastSale({ orders }: { orders: OrderView[] }) {
  const sale = orders.find((o) => o.status === "filled" && o.closeTx);
  const href = sale?.closeTx && explorerUrl("tx", sale.closeTx);
  return (
    <section className="demo-panel" aria-label="Last sale">
      <div className="demo-panel__head">
        <span className="t-field-label">Last sale</span>
        {sale && <Stamp status="sold" />}
      </div>
      {sale?.closeTx ? (
        <>
          <p className="caveat">
            {tokensLabel(BigInt(sale.order.amount))} at USDC {formatUsdc(BigInt(sale.order.price))}. Co-signed by {venueLabel(sale.order.venue)}, the order's venue.
          </p>
          <Hash value={sale.closeTx} href={href} />
          {href ? (
            <a className="wallet-link" href={href} target="_blank" rel="noreferrer">
              See it on Snowtrace
            </a>
          ) : (
            <p className="caveat">Local network: this transaction has no explorer.</p>
          )}
        </>
      ) : (
        <p className="caveat">No sales yet.</p>
      )}
    </section>
  );
}

/** The scanned feed, read from the server's shared scan. Slow on purpose: live rows come from the order service. */
function useScannedFeed() {
  const [state, setState] = useState<ConsoleState | null>(null);
  useEffect(() => {
    let live = true;
    async function load() {
      try {
        const response = await fetch("/console/api/state", { cache: "no-store" });
        if (!response.ok) throw new Error(`console state: ${response.status}`);
        const next = parseBig<ConsoleState>(await response.text());
        if (live) setState(next);
      } catch (error) {
        console.error("feed refresh failed", error);
      }
    }
    load();
    const timer = setInterval(load, FEED_POLL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);
  return state;
}

function refusalRow(result: DirectResult, from: Address, asset: string): FeedEntry {
  const at = Math.floor(Date.now() / 1000);
  return {
    id: `directa:${result.hash}`,
    at,
    order: at * 1000,
    event: "Refused",
    status: "blocked",
    asset,
    from,
    fromRole: "Account",
    price: "-",
    unit: " ",
    hash: result.hash,
    code: /^\w+/.exec(result.reason ?? "")?.[0] ?? "TransactionReverted",
    detail: "Direct purchase from an unverified account.",
  };
}

const OPENING_LINE = "The seller signs a sell order. It is free and her tokens do not move.";

/** One plain sentence for what just happened, so the page reads without narration. */
function storyLine(book: Book, refused: boolean, untouched: boolean) {
  if (!book.loaded) return "Reading the order book.";
  if (untouched) return OPENING_LINE;
  if (refused) return "The contract refused the unverified account's purchase. No tokens or USDC moved.";
  const moment = (view: OrderView) => view.closedAt ?? view.announcedAt ?? 0;
  const latest = book.orders.reduce<OrderView | undefined>((best, view) => (!best || moment(view) > moment(best) ? view : best), undefined);
  if (latest?.status === "open") return "Order posted. The tokens are still in the seller's wallet. Banco Norte can buy now.";
  if (latest?.status === "filled") return "Sale settled in one transaction: tokens to the buyer, USDC to the seller. Neither paid gas.";
  if (latest?.status === "cancelled") return "The seller cancelled the order. Nothing moved.";
  return OPENING_LINE;
}

/** The guided walkthrough is the default. `#all` opens everything at once. */
function useFreeView() {
  const [free, setFree] = useState(false);
  useEffect(() => {
    const read = () => setFree(window.location.hash === "#all");
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  return free;
}

function Stage({ config }: { config: WalletConfig }) {
  const freeView = useFreeView();
  const book = useBook();
  const seller = useWallet(config, config.seller);
  const buyer = useWallet(config, config.buyer);
  const scanned = useScannedFeed();
  const [refusals, setRefusals] = useState<FeedEntry[]>([]);
  const [refusedAt, setRefusedAt] = useState<string | null>(null);
  const asset = seller.snapshot?.tokenName ?? "Token";

  const refreshSeller = seller.refresh;
  const refreshBuyer = buyer.refresh;
  const refreshBook = book.refresh;
  const refreshAll = useCallback(() => {
    refreshBook();
    refreshSeller();
    refreshBuyer();
  }, [refreshBook, refreshSeller, refreshBuyer]);

  // Balances follow the book: when an order changes state, both phones read the chain again.
  const signature = book.orders.map((o) => `${o.orderHash}:${o.status}`).join();
  useEffect(() => {
    refreshSeller();
    refreshBuyer();
  }, [signature, refreshSeller, refreshBuyer]);

  const feed = useMemo(() => {
    const live = [...feedFromOrders(book.orders, () => asset), ...refusals];
    return mergeFeed(scanned?.feed ?? [], live);
  }, [book.orders, refusals, scanned, asset]);

  // What was already in the book when the page opened is not news.
  const openedOn = useRef<string | null>(null);
  if (book.loaded && openedOn.current === null) openedOn.current = signature;

  const open = firstOpen(book.orders);
  const shared = { orders: book.orders, refresh: refreshAll };
  const onRefusal = (result: DirectResult) => {
    if (!result.reverted) return;
    setRefusedAt(signature);
    setRefusals((list) => [...list, refusalRow(result, config.unverified, asset)]);
  };

  // The guide stays mounted behind the free view, so a step running there keeps its result.
  const guide = (
    <div hidden={freeView}>
      <Guide config={config} book={book} seller={{ ...seller, ...shared }} buyer={{ ...buyer, ...shared }} feed={feed} onRefusal={onRefusal} caveat={CAVEAT} storeNote={STORE_NOTE} />
    </div>
  );
  if (!freeView) return guide;

  return (
    <>
      {guide}
      <FreeView config={config} book={book} seller={{ ...seller, ...shared }} buyer={{ ...buyer, ...shared }} feed={feed} open={open} story={storyLine(book, refusedAt === signature, openedOn.current === signature && refusedAt !== signature)} onRefusal={onRefusal} />
    </>
  );
}

type FreeViewProps = { config: WalletConfig; book: Book; seller: Wallet; buyer: Wallet; feed: FeedEntry[]; open: OrderView | undefined; story: string; onRefusal: (result: DirectResult) => void };

/** Everything at once, for whoever already knows the story. */
function FreeView({ config, book, seller, buyer, feed, open, story, onRefusal }: FreeViewProps) {
  return (
    <main className="demo" lang="en">
      <header className="demo__head">
        <img className="demo__logo" src="/design/logos/handoff-lockup-horizontal.svg" alt="Handoff" />
        <h1 className="t-title">Two wallets, one shared order book</h1>
        <a className="wallet-link" href="#guided">
          Back to the guided demo
        </a>
        <div className="demo__caveat">
          <p className="caveat">{CAVEAT}</p>
          <p className="caveat">{STORE_NOTE}</p>
        </div>
      </header>

      <p className="demo__story" role="status">
        {story}
      </p>

      <div className="demo__stage">
        <SellerPhone config={config} wallet={seller} book={book} />
        <BuyerPhone config={config} wallet={buyer} book={book} />
        <div className="demo__side">
          <div className="demo__feed">
            <ComplianceFeed entries={feed} />
          </div>
          <div className="demo__controls">
            <LastSale orders={book.orders} />
            <UnverifiedControl config={config} order={open} onResult={onRefusal} />
          </div>
        </div>
      </div>
    </main>
  );
}

export function DemoApp() {
  const config = walletConfig();
  if (!config) {
    return (
      <main className="demo" lang="en">
        <Notice status="pending">The issuer has not registered the token on this network yet.</Notice>
      </main>
    );
  }
  return <Stage config={config} />;
}
