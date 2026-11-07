"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { encodeFunctionData, isAddressEqual, type Address } from "viem";
import { Button, Hash, Notice, OperatedBy, Stamp, Tabs, type StampStatus } from "@/design";
import { handoffSettlementAbi } from "@/lib/abi";
import { parseBig } from "@/lib/big-json";
import { chainName, explorerUrl, networkLabel } from "@/lib/chain";
import { feedFromOrders, mergeFeed, type FeedEntry } from "@/lib/console/feed";
import type { ConsoleState } from "@/lib/console/state";
import { venue, VenueRefusal } from "@/lib/orders/client";
import { fromWireOrder, type OrderStatus, type OrderView } from "@/lib/orders/types";
import { venueLabel, VENUES } from "@/lib/orders/venues";
import { sendDirect, type DirectResult } from "@/lib/sponsor/direct";
import { walletConfig, type WalletConfig } from "@/lib/wallet/deployment";
import { formatUsdc, tokensLabel } from "@/lib/wallet/format";
import { MarketSection } from "../_wallet/MarketSection";
import { FillProof, OrderCoupon } from "../_wallet/OrderCoupon";
import { SellSection } from "../_wallet/SellSection";
import { useAction, useWallet, type Precheck, type Wallet } from "../_wallet/useWallet";
import { ComplianceFeed } from "../console/ComplianceFeed";
import { useBook, type Book } from "./useBook";

const FEED_POLL_MS = chainName === "local" ? 3000 : 15_000;
const CAVEAT = "Atestaciones de demostración en Fuji, sin verificación de identidad.";
const STORE_NOTE =
  chainName === "local"
    ? "Red local: el SDK de KUMPLY lee un stub de prueba."
    : "Instancia de demostración del contrato de KUMPLY. No es el almacén oficial de KUMPLY.";

const HOST_STAMP: Record<Precheck, StampStatus> = { checking: "pending", passed: "verified", blocked: "blocked", unavailable: "pending" };
const BOOK_STAMP: Record<OrderStatus, { status: StampStatus; word: string }> = {
  open: { status: "unused", word: "Abierta" },
  filled: { status: "sold", word: "Vendido" },
  cancelled: { status: "cancelled", word: "Cancelada" },
  expired: { status: "cancelled", word: "Vencida" },
};

const couponNumber = (view: OrderView) => `N.º ${(BigInt(view.order.nonce) % 10_000n).toString().padStart(4, "0")}`;

/** Oldest first, the order the market takes them in. */
function firstOpen(orders: OrderView[]) {
  return orders.findLast((o) => o.status === "open");
}

/** The shared set, the same rows on both phones. */
function BookStrip({ book }: { book: Book }) {
  return (
    <section className="demo-book" aria-label="Libro de órdenes compartido">
      <h3 className="t-field-label">Libro compartido entre las dos billeteras</h3>
      <p className="caveat">Cada orden la co-firma su propia plataforma, no la de quien compra.</p>
      {book.orders.length === 0 ? (
        <p className="caveat">{book.loaded ? "Todavía no hay órdenes." : "Leyendo el libro."}</p>
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
        <span className="t-field-label">Opera por {venueName}</span>
        <Hash value={wallet.address} href={explorerUrl("address", wallet.address)} />
      </div>
      {nav}
      <main className="host__main demo-phone__body" key={view}>
        {wallet.offline && <Notice status="pending">No pudimos leer {networkLabel}. Reintentando.</Notice>}
        {children}
      </main>
      <BookStrip book={book} />
      <footer className="host__foot demo-phone__foot">
        <OperatedBy />
      </footer>
    </article>
  );
}

type SellerTab = "vender" | "ordenes";

function SellerPhone({ config, wallet, book }: { config: WalletConfig; wallet: Wallet; book: Book }) {
  const [tab, setTab] = useState<SellerTab>("vender");
  const mine = useMemo(() => book.orders.filter((o) => isAddressEqual(o.order.seller, wallet.address)), [book.orders, wallet.address]);
  const known = useRef<number | null>(null);

  // A posted order takes the seller to its coupon, so the tear happens on screen.
  useEffect(() => {
    if (!book.loaded) return;
    if (known.current !== null && mine.length > known.current) setTab("ordenes");
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
        ariaLabel="Secciones de Billetera Sur"
        items={[
          { label: "Vender", href: "#vender", current: tab === "vender" },
          { label: "Tus órdenes", href: "#ordenes", current: tab === "ordenes" },
        ]}
      />
    </div>
  );

  return (
    <Phone brand="Billetera Sur" role="Vendedora" venueName={VENUES[0]?.label ?? "PSAV 1"} wallet={wallet} book={book} nav={nav} view={tab}>
      {tab === "vender" ? (
        <SellSection config={config} actor="seller" wallet={wallet} />
      ) : (
        <section className="wallet-stack">
          <h2 className="t-title">Tus órdenes</h2>
          {mine.length === 0 && <p className="caveat">Todavía no tenés órdenes.</p>}
          {mine.map((view) => (
            <div className="wallet-stack" key={view.orderHash}>
              <OrderCoupon
                view={view}
                label="Orden de venta"
                tokenName={wallet.snapshot?.tokenName ?? "Token"}
                torn={book.torn.has(view.orderHash)}
                note={view.status === "open" ? `Publicada por ${venueLabel(view.order.venue)}. Tus tokens siguen en tu billetera.` : undefined}
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
    <Phone brand="Banco Norte" role="Comprador" venueName={VENUES[1]?.label ?? "PSAV 2"} wallet={wallet} book={book}>
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
      // A venue that refuses outright still leaves a named revert: the fill goes out with no co-signature.
      const venueSig = await venue.coSign(view.orderHash, config.unverified, true).catch((error: unknown) => {
        if (error instanceof VenueRefusal) return "0x" as const;
        throw error;
      });
      const data = encodeFunctionData({ abi: handoffSettlementAbi, functionName: "fill", args: [fromWireOrder(view.order), view.sellerSig, venueSig] });
      const result = await sendDirect("unverified", { to: config.settlement, data });
      setAttempt(result);
      onResult(result);
    });
  }

  return (
    <section className="demo-panel" aria-label="Cuenta sin verificar">
      <div className="demo-panel__head">
        <span className="t-field-label">Cuenta sin verificar</span>
        <Hash value={config.unverified} href={explorerUrl("address", config.unverified)} />
      </div>
      <p className="caveat">Saltea la billetera y llama al contrato, pagando su propio gas.</p>
      <Button variant="secondary" size="sm" busy={action.busy} disabled={!order} onClick={() => order && run(order)}>
        Intentar compra directa
      </Button>
      {!order && <p className="caveat">Hace falta una orden abierta.</p>}
      {action.error && (
        <Notice status="blocked" word="Sin enviar">
          {action.error}
        </Notice>
      )}
      {attempt && (
        <div className="demo-panel__result">
          <Stamp status={attempt.reverted ? "reverted" : "sold"}>{attempt.reverted ? "Rechazada" : "Sin revertir"}</Stamp>
          {attempt.reverted && <p className="caveat">El contrato rechazó la compra: {attempt.reason}</p>}
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
    <section className="demo-panel" aria-label="Última venta">
      <div className="demo-panel__head">
        <span className="t-field-label">Última venta</span>
        {sale && <Stamp status="sold" />}
      </div>
      {sale?.closeTx ? (
        <>
          <p className="caveat">
            {tokensLabel(BigInt(sale.order.amount))} a USDC {formatUsdc(BigInt(sale.order.price))}. Co-firma {venueLabel(sale.order.venue)}, la plataforma de la orden.
          </p>
          <Hash value={sale.closeTx} href={href} />
          {href ? (
            <a className="wallet-link" href={href} target="_blank" rel="noreferrer">
              Ver en Snowtrace
            </a>
          ) : (
            <p className="caveat">Red local: esta transacción no tiene explorador.</p>
          )}
        </>
      ) : (
        <p className="caveat">Todavía no hay ventas.</p>
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
    event: "Rechazado",
    status: "blocked",
    asset,
    from,
    fromRole: "Cuenta",
    price: "-",
    unit: " ",
    hash: result.hash,
    code: /^\w+/.exec(result.reason ?? "")?.[0] ?? "TransactionReverted",
    detail: "Compra directa de una cuenta sin verificar.",
  };
}

const OPENING_LINE = "La vendedora firma una orden de venta. Es gratis y sus tokens no se mueven.";

/** One plain sentence for what just happened, so the page reads without narration. */
function storyLine(book: Book, refused: boolean, untouched: boolean) {
  if (!book.loaded) return "Leyendo el libro de órdenes.";
  if (untouched) return OPENING_LINE;
  if (refused) return "El contrato rechazó la compra de la cuenta sin verificar. No se movieron tokens ni USDC.";
  const moment = (view: OrderView) => view.closedAt ?? view.announcedAt ?? 0;
  const latest = book.orders.reduce<OrderView | undefined>((best, view) => (!best || moment(view) > moment(best) ? view : best), undefined);
  if (latest?.status === "open") return "Orden publicada. Los tokens siguen en la billetera de la vendedora. Ahora Banco Norte puede comprar.";
  if (latest?.status === "filled") return "Venta liquidada en una sola transacción: tokens al comprador, USDC a la vendedora. Ninguno pagó gas.";
  if (latest?.status === "cancelled") return "La vendedora canceló la orden. No se movió nada.";
  return OPENING_LINE;
}

function Stage({ config }: { config: WalletConfig }) {
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

  return (
    <main className="demo" lang="es">
      <header className="demo__head">
        <img className="demo__logo" src="/design/logos/handoff-lockup-horizontal.svg" alt="Handoff" />
        <h1 className="t-title">Dos billeteras, un libro de órdenes compartido</h1>
        <div className="demo__caveat">
          <p className="caveat">{CAVEAT}</p>
          <p className="caveat">{STORE_NOTE}</p>
        </div>
      </header>

      <p className="demo__story" role="status">
        {storyLine(book, refusedAt === signature, openedOn.current === signature && refusedAt !== signature)}
      </p>

      <div className="demo__stage">
        <SellerPhone config={config} wallet={{ ...seller, ...shared }} book={book} />
        <BuyerPhone config={config} wallet={{ ...buyer, ...shared }} book={book} />
        <div className="demo__side">
          <div className="demo__feed">
            <ComplianceFeed entries={feed} />
          </div>
          <div className="demo__controls">
            <LastSale orders={book.orders} />
            <UnverifiedControl config={config} order={open} onResult={(result) => { if (result.reverted) setRefusedAt(signature); setRefusals((list) => (result.reverted ? [...list, refusalRow(result, config.unverified, asset)] : list)); }} />
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
      <main className="demo" lang="es">
        <Notice status="pending">El emisor todavía no registró el token en esta red.</Notice>
      </main>
    );
  }
  return <Stage config={config} />;
}
