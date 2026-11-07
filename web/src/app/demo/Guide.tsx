"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { isAddressEqual, type Hash as TxHash } from "viem";
import { Button, Hash, Notice, OperatedBy, Stamp } from "@/design";
import { chainName, explorerUrl, networkLabel } from "@/lib/chain";
import type { FeedEntry } from "@/lib/console/feed";
import { reasonText } from "@/lib/console/reasons";
import type { OrderView } from "@/lib/orders/types";
import { venueLabel, VENUES } from "@/lib/orders/venues";
import { SPONSOR_LABEL } from "@/lib/sponsor";
import type { DirectResult } from "@/lib/sponsor/direct";
import type { WalletConfig } from "@/lib/wallet/deployment";
import { formatCount, formatUsdc, tokensLabel } from "@/lib/wallet/format";
import { FillProof, OrderCoupon } from "../_wallet/OrderCoupon";
import { useAction, type Wallet } from "../_wallet/useWallet";
import { ComplianceFeed } from "../console/ComplianceFeed";
import { attemptUnverified, buyOrder, postOrder, readHoldings, type Holdings, type Say } from "./actions";
import type { Book } from "./useBook";

const AMOUNT = 1n;
const SLOW_S = 30;
const REFUSAL_CODE = "ReceiverNotAttested";

const STEPS = [
  { id: "intro", rail: "What this is" },
  { id: "sell", rail: "The seller posts" },
  { id: "refuse", rail: "An unverified attempt" },
  { id: "buy", rail: "The buyer buys" },
  { id: "record", rail: "What gets recorded" },
  { id: "end", rail: "What was real" },
] as const;

type StepId = (typeof STEPS)[number]["id"];
type Part = "seller" | "buyer" | "unverified" | "feed";

type Refused = { result: DirectResult; at: number; before: Holdings | null; after: Holdings | null };
type Moved = { before: Holdings; after: Holdings };
type Bought = { hash: TxHash; userOpHash?: TxHash; seconds?: number; seller?: Moved; buyer?: Moved };
type Progress = { posted: OrderView | null; tokensBefore: bigint | null; tokensAfter: bigint | null; refused: Refused | null; bought: Bought | null };
type Problem = { waiting: boolean; text: string };

const NOTHING_YET: Progress = { posted: null, tokensBefore: null, tokensAfter: null, refused: null, bought: null };

/** What the screen points at on each step. Everything else steps back. */
function litParts(step: StepId, { refused, bought }: Progress): Part[] {
  switch (step) {
    case "intro":
      return ["seller", "buyer"];
    case "sell":
      return ["seller"];
    case "refuse":
      return refused ? ["unverified", "feed"] : ["unverified"];
    case "buy":
      return bought ? ["buyer", "seller"] : ["buyer"];
    case "record":
      return ["feed"];
    case "end":
      return ["seller", "buyer", "unverified", "feed"];
  }
}

/** One real action on a step: its working state, what it is doing now, and how long it has been at it. */
function useStepTask() {
  const action = useAction();
  const [phase, setPhase] = useState("");
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!action.busy) return;
    const started = Date.now();
    setSeconds(0);
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [action.busy]);

  return { busy: action.busy, error: action.error, phase, seconds, start: (work: (say: Say) => Promise<void>) => action.run(() => work(setPhase)) };
}

type Task = ReturnType<typeof useStepTask>;

function Rail({ step, furthest, done, locked, onGo }: { step: number; furthest: number; done: (index: number) => boolean; locked: boolean; onGo: (index: number) => void }) {
  return (
    <nav className="guide-rail" aria-label="Demo steps">
      <ol>
        {STEPS.map(({ id, rail }, index) => (
          <li key={id} data-state={index === step ? "current" : done(index) ? "done" : "pending"}>
            <button type="button" disabled={locked || index > furthest} aria-current={index === step ? "step" : undefined} onClick={() => onGo(index)}>
              <span className="guide-rail__dot" aria-hidden="true" />
              <span className="guide-rail__label">{rail}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="guide-block">
      <h2 className="t-field-label">{title}</h2>
      {children}
    </section>
  );
}

function ExplorerLink({ hash, label }: { hash: TxHash; label: string }) {
  const href = explorerUrl("tx", hash);
  return (
    <p className="guide-proof">
      <Hash value={hash} href={href} />
      {href ? (
        <a className="wallet-link" href={href} target="_blank" rel="noreferrer">
          {label}
        </a>
      ) : (
        <span className="caveat">Local network: this transaction has no explorer.</span>
      )}
    </p>
  );
}

function Ledger({ rows }: { rows: { label: string; before: string; after: string }[] }) {
  return (
    <table className="guide-ledger">
      <thead>
        <tr>
          <td />
          <th scope="col">Before</th>
          <th scope="col">After</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ label, before, after }) => (
          <tr key={label} data-moved={before !== after || undefined}>
            <th scope="row">{label}</th>
            <td>{before}</td>
            <td>{after}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** While the step runs: what it is doing and for how long. On failure: what went wrong; the step's button retries. */
function StepState({ task, failure }: { task: Task; failure: string }) {
  if (task.busy) {
    return (
      <div className="guide-wait">
        <p role="status">{task.phase}</p>
        <p className="caveat">
          {task.seconds < SLOW_S ? `This can take a few seconds. ${task.seconds} s so far.` : `This is taking longer than usual: ${task.seconds} s. Still waiting on ${networkLabel}.`}
        </p>
      </div>
    );
  }
  if (!task.error) return null;
  return (
    <div className="guide-wait">
      <Notice status="blocked" word="Failed">
        {failure}
      </Notice>
      <p className="caveat guide-detail">{task.error}</p>
    </div>
  );
}

function accountProblem({ snapshot, precheck }: Wallet, who: string): Problem | null {
  if (precheck === "unavailable") return { waiting: true, text: `Could not read ${who} on ${networkLabel}. Retrying.` };
  if (precheck === "checking" || !snapshot) return { waiting: true, text: `Reading ${who} on ${networkLabel}.` };
  if (precheck === "blocked") return { waiting: false, text: `This deployment has no attestation for ${who}, so it cannot trade.` };
  if (snapshot.blocked) return { waiting: false, text: `The PSAV blocked ${who}.` };
  if (snapshot.paused) return { waiting: false, text: "Trading in this token is paused." };
  return null;
}

function sellerProblem(wallet: Wallet): Problem | null {
  const problem = accountProblem(wallet, "the seller's account");
  if (problem) return problem;
  return wallet.snapshot && wallet.snapshot.tokens < AMOUNT ? { waiting: false, text: "The seller has no tokens left to sell." } : null;
}

function buyerProblem(wallet: Wallet, total: bigint): Problem | null {
  const problem = accountProblem(wallet, "the buyer's account");
  if (problem) return problem;
  const usdc = wallet.snapshot?.usdc ?? 0n;
  if (usdc >= total) return null;
  return { waiting: false, text: `The buyer cannot pay for this: the account holds USDC ${formatUsdc(usdc)} and the token costs USDC ${formatUsdc(total)}. This step cannot run until the account receives more USDC.` };
}

function Blocker({ problem }: { problem: Problem }) {
  if (problem.waiting) {
    return (
      <p className="caveat" role="status">
        {problem.text}
      </p>
    );
  }
  return (
    <Notice status="blocked" word="Stopped">
      {problem.text}
    </Notice>
  );
}

/** The order this run created is gone from under it: someone closed it from another screen. */
function OrderGone({ order, onRepost }: { order: OrderView; onRepost: () => void }) {
  const what = order.status === "filled" ? "was sold to another account" : order.status === "cancelled" ? "was cancelled" : "expired";
  return (
    <div className="guide-wait">
      <Notice status="pending" word="Closed">
        The order from this run {what}. Post a new one to continue.
      </Notice>
      <Button variant="primary" size="lg" onClick={onRepost}>
        Post another order
      </Button>
    </div>
  );
}

function holdingRows(who: string, { before, after }: Moved) {
  return [
    { label: `${who}, tokens`, before: formatCount(before.tokens), after: formatCount(after.tokens) },
    { label: `${who}, USDC`, before: formatUsdc(before.usdc), after: formatUsdc(after.usdc) },
  ];
}

const REAL =
  chainName === "local"
    ? ["The contracts, signatures and transactions, on a local test network.", "The refusal: the contract decides it, not this screen."]
    : ["The contracts and transactions, on Fuji. You can check them on Snowtrace.", "The seller's signature and the co-signature of PSAV 1, which co-signs every order.", "The refusal: the contract decides it, not this screen.", "The gas sponsorship, through 0xGasless."];

const SIMULATED = [
  ...(chainName === "local" ? ["The gas sponsorship: simulated on the local network."] : []),
  "The attestations: demo ones, with no identity verification.",
  "The security is fictional and the USDC is test USDC.",
  "The registry report acknowledgment.",
];

const RUNS_ON = chainName === "local" ? "This run is on a local test network." : "This demo runs on the Fuji C-Chain.";

type Props = { config: WalletConfig; book: Book; seller: Wallet; buyer: Wallet; feed: FeedEntry[]; onRefusal: (result: DirectResult) => void; caveat: string; storeNote: string };

export function Guide({ config, book, seller, buyer, feed, onRefusal, caveat, storeNote }: Props) {
  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [progress, setProgress] = useState<Progress>(NOTHING_YET);
  const posting = useStepTask();
  const refusing = useStepTask();
  const buying = useStepTask();
  const heading = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  const stepId = STEPS[step].id;
  const { posted, refused, bought } = progress;
  const asset = seller.snapshot?.tokenName ?? "Token";
  const reference = seller.snapshot?.reference;

  // The book is newer than what the post returned; until it lists the order, what the post returned is all there is.
  const order = posted ? (book.orders.find((o) => o.orderHash === posted.orderHash) ?? posted) : null;
  const soldToBuyer = order?.status === "filled" && order.buyer !== undefined && isAddressEqual(order.buyer, config.buyer);
  const gone = order !== null && order.status !== "open" && !soldToBuyer && !bought;
  const locked = posting.busy || refusing.busy || buying.busy;

  // A fill that landed while its answer got lost still landed: the book has the last word, so a retry never buys twice.
  const landedTx = soldToBuyer ? order?.closeTx : undefined;
  useEffect(() => {
    if (landedTx && !buying.busy) setProgress((p) => (p.bought ? p : { ...p, bought: { hash: landedTx } }));
  }, [landedTx, buying.busy]);

  useEffect(() => {
    if (moved.current) heading.current?.focus({ preventScroll: true });
  }, [step]);

  function go(index: number) {
    moved.current = true;
    setDirection(index < step ? "back" : "forward");
    setStep(index);
    setFurthest((f) => Math.max(f, index));
  }

  function restartAt(index: number) {
    setProgress(NOTHING_YET);
    setFurthest(index);
    go(index);
  }

  function publish() {
    if (reference === undefined || !seller.snapshot) return;
    const before = seller.snapshot.tokens;
    return posting.start(async (say) => {
      const view = await postOrder(config, seller.address, AMOUNT, reference, say);
      say("Reading the seller's balance.");
      const after = await readHoldings(config, seller.address);
      setProgress((p) => ({ ...p, posted: view, tokensBefore: before, tokensAfter: after?.tokens ?? null }));
      seller.refresh();
    });
  }

  function attempt() {
    if (!order) return;
    return refusing.start(async (say) => {
      say("Reading the unverified account's balance.");
      const at = Math.floor(Date.now() / 1000);
      const before = await readHoldings(config, config.unverified);
      const result = await attemptUnverified(config, order, say);
      say("Reading the balance after the attempt.");
      const after = await readHoldings(config, config.unverified);
      setProgress((p) => ({ ...p, refused: { result, at, before, after } }));
      onRefusal(result);
    });
  }

  function buy() {
    if (!order) return;
    return buying.start(async (say) => {
      say("Reading both balances.");
      const [sellerBefore, buyerBefore] = await Promise.all([readHoldings(config, seller.address), readHoldings(config, buyer.address)]);
      const started = Date.now();
      const { hash, userOpHash } = await buyOrder(config, order, say);
      const seconds = Math.max(1, Math.round((Date.now() - started) / 1000));
      say("Reading both balances after the sale.");
      const [sellerAfter, buyerAfter] = await Promise.all([readHoldings(config, seller.address), readHoldings(config, buyer.address)]);
      setProgress((p) => ({
        ...p,
        bought: {
          hash,
          userOpHash,
          seconds,
          seller: sellerBefore && sellerAfter ? { before: sellerBefore, after: sellerAfter } : undefined,
          buyer: buyerBefore && buyerAfter ? { before: buyerBefore, after: buyerAfter } : undefined,
        },
      }));
      seller.refresh();
    });
  }

  function done(index: number) {
    if (index < furthest) return true;
    const id = STEPS[index].id;
    return (id === "sell" && Boolean(posted)) || (id === "refuse" && Boolean(refused)) || (id === "buy" && Boolean(bought));
  }

  const next = (label: string) => (
    <Button variant="primary" size="lg" onClick={() => go(step + 1)}>
      {label}
    </Button>
  );

  function introStep() {
    return {
      title: "What this is",
      body: (
        <>
          <p className="guide-lead">The holder of a tokenized security sells it to another verified person, inside their wallet, without paying gas, the network fee.</p>
          <p className="guide-text">Each wallet is run by a PSAV, a licensed virtual asset provider. You will take four steps, and each one runs for real on {networkLabel}: you press one button, then we explain what happened.</p>
        </>
      ),
      action: next("Start"),
    };
  }

  function sellStep() {
    const title = "The seller posts an order";
    if (posted) {
      const couponNo = (BigInt(posted.order.nonce) % 10_000n).toString().padStart(4, "0");
      const { tokensBefore, tokensAfter } = progress;
      return {
        title,
        body: (
          <>
            <Block title="What happened">
              <p className="guide-lead">Order No. {couponNo} is in the book. The seller signed without paying anything, and her token is still in her wallet.</p>
            </Block>
            {tokensBefore !== null && tokensAfter !== null && <Ledger rows={[{ label: "Seller, tokens", before: formatCount(tokensBefore), after: formatCount(tokensAfter) }]} />}
            <ExplorerLink hash={posted.announceTx} label="See the order on Snowtrace" />
            <Block title="Why it matters">
              <p className="guide-text">Offering costs nothing and nobody takes custody of her tokens. They move only if someone buys.</p>
            </Block>
          </>
        ),
        action: next("Next: an unverified attempt"),
      };
    }
    const problem = sellerProblem(seller);
    return {
      title,
      body: (
        <>
          <Block title="What is about to happen">
            <p className="guide-lead">
              She offers {tokensLabel(AMOUNT)}
              {reference !== undefined && ` at USDC ${formatUsdc(reference)}, the reference price`}. Signing is free, the token stays in her wallet, and the PSAV publishes the order.
            </p>
          </Block>
          <StepState task={posting} failure="We could not post the order. The token is still in the seller's wallet." />
          {problem && !posting.busy && <Blocker problem={problem} />}
        </>
      ),
      action: (
        <Button variant="primary" size="lg" busy={posting.busy} disabled={Boolean(problem)} onClick={publish}>
          {posting.error ? "Retry posting" : "Sign and post the order"}
        </Button>
      ),
    };
  }

  function refuseStep() {
    const title = "Someone unverified tries to buy";
    if (refused) {
      const { result, before, after } = refused;
      const code = /^\w+/.exec(result.reason ?? "")?.[0] ?? "TransactionReverted";
      if (!result.reverted) {
        return {
          title,
          body: (
            <>
              <Notice status="blocked" word="Unexpected">
                The contract did not refuse this purchase. Check the transaction before going on.
              </Notice>
              <ExplorerLink hash={result.hash} label="See the transaction on Snowtrace" />
            </>
          ),
          action: null,
        };
      }
      return {
        title,
        body: (
          <>
            <Block title="What happened">
              <div className="guide-verdict">
                <Stamp status="reverted">Refused</Stamp>
                <code className="guide-code">{code}</code>
              </div>
              <p className="guide-lead">{reasonText(code)} No tokens or USDC moved, and the order is still open.</p>
              {code !== REFUSAL_CODE && <p className="guide-text">We expected {REFUSAL_CODE}. The contract stopped the purchase earlier, for the reason above.</p>}
            </Block>
            {before && after && <Ledger rows={holdingRows("Unverified account", { before, after })} />}
            <ExplorerLink hash={result.hash} label="See the refusal on Snowtrace" />
            <Block title="Why it matters">
              <p className="guide-text">The rule lives in the contract, not in the app. Skipping the screen gets you nowhere.</p>
            </Block>
          </>
        ),
        action: next("Next: the verified purchase"),
      };
    }
    return {
      title,
      body: (
        <>
          <Block title="What is about to happen">
            <p className="guide-lead">An unverified account skips the app and calls the contract directly to buy that same order, paying its own gas.</p>
          </Block>
          {gone && order ? <OrderGone order={order} onRepost={() => restartAt(1)} /> : <StepState task={refusing} failure="The attempt did not reach the contract. Nothing moved." />}
        </>
      ),
      action: gone ? null : (
        <Button variant="primary" size="lg" busy={refusing.busy} onClick={attempt}>
          {refusing.error ? "Retry the attempt" : "Try the direct purchase"}
        </Button>
      ),
    };
  }

  function buyStep() {
    const title = "The verified buyer buys";
    if (bought) {
      const proof = order ? { ...order, closeTx: order.closeTx ?? bought.hash } : null;
      return {
        title,
        body: (
          <>
            <Block title="What happened">
              <div className="guide-verdict">
                <Stamp status="sold">Sold</Stamp>
                {bought.seconds !== undefined && <span className="caveat">Took {bought.seconds} s.</span>}
              </div>
              <p className="guide-lead">The token went to the buyer and the USDC to the seller in one transaction. Neither of them paid gas.</p>
            </Block>
            {bought.buyer && bought.seller && <Ledger rows={[...holdingRows("Buyer", bought.buyer), ...holdingRows("Seller", bought.seller)]} />}
            {proof && <FillProof view={proof} userOpHash={bought.userOpHash} />}
            {!bought.userOpHash && <p className="caveat">{SPONSOR_LABEL}</p>}
            <Block title="Why it matters">
              <p className="guide-text">There is no halfway state: both sides move or neither does. And the buyer needs no AVAX for gas.</p>
            </Block>
          </>
        ),
        action: next("Next: what gets recorded"),
      };
    }
    if (!order) return { title, body: null, action: null };
    const amount = BigInt(order.order.amount);
    const total = amount * BigInt(order.order.price);
    const problem = buyerProblem(buyer, total);
    return {
      title,
      body: (
        <>
          <Block title="What is about to happen">
            <p className="guide-lead">
              One tap: the buyer pays USDC {formatUsdc(total)} and receives {tokensLabel(amount)} in the same transaction, with no gas to pay.
            </p>
            <p className="guide-text">This buys the order you just saw posted. {venueLabel(order.order.venue)} co-signs it.</p>
          </Block>
          {gone ? <OrderGone order={order} onRepost={() => restartAt(1)} /> : <StepState task={buying} failure="The purchase did not complete. If it reached the contract, the order will show as sold and this step moves on by itself." />}
          {!gone && problem && !buying.busy && <Blocker problem={problem} />}
        </>
      ),
      action: gone ? null : (
        <Button variant="primary" size="lg" busy={buying.busy} disabled={Boolean(problem)} onClick={buy}>
          {buying.error ? "Retry the purchase" : `Buy ${tokensLabel(amount)}`}
        </Button>
      ),
    };
  }

  function recordStep() {
    return {
      title: "What gets recorded",
      body: (
        <>
          <p className="guide-lead">What you just saw left rows in the compliance feed. This is what the PSAV's compliance officer reads.</p>
          <ul className="guide-list">
            <li>The order: who is selling, how much and at what price.</li>
            <li>The refusal: which account tried to buy and why it could not.</li>
            <li>The sale: who sold, who bought and at what price.</li>
          </ul>
          {bought && <ExplorerLink hash={bought.hash} label="See the sale on Snowtrace" />}
          <Block title="Why it matters">
            <p className="guide-text">The contract is one control. Following and reporting what happens is the PSAV's obligation, and this feed is where it does that.</p>
          </Block>
        </>
      ),
      action: next("Next: what was real"),
    };
  }

  function endStep() {
    return {
      title: "What was real and what was not",
      body: (
        <>
          <div className="guide-truth">
            <Block title="Real">
              <ul className="guide-list">
                {REAL.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </Block>
            <Block title="Simulated">
              <ul className="guide-list">
                {SIMULATED.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </Block>
          </div>
          <Block title="Why Avalanche">
            <p className="guide-text">
              The rules cap each issuance at five licensed operators sharing one real-time record. That fits an Avalanche L1 with one validator per operator, linked to USDC on the C-Chain through ICM. {RUNS_ON} The L1 is the roadmap.
            </p>
          </Block>
          <p className="guide-links">
            <a className="wallet-link" href="/console">
              Open the issuer and PSAV console
            </a>
            <a className="wallet-link" href="/">
              Open the wallet
            </a>
          </p>
        </>
      ),
      action: (
        <Button variant="primary" size="lg" onClick={() => restartAt(0)}>
          Start over
        </Button>
      ),
    };
  }

  const view = { intro: introStep, sell: sellStep, refuse: refuseStep, buy: buyStep, record: recordStep, end: endStep }[stepId]();
  const lit = litParts(stepId, progress);
  const isLit = (part: Part) => lit.includes(part) || undefined;

  // Only what this run did: rows left by earlier runs would point the eye at the wrong thing.
  const ours = new Set([posted?.announceTx, refused?.result.hash, order?.closeTx ?? bought?.hash].filter(Boolean));
  const rows = feed.filter((entry) => (entry.hash && ours.has(entry.hash as TxHash)) || (refused && entry.code === "buyer_not_attested" && entry.at >= refused.at));

  const coupon = (label: string) =>
    order ? <OrderCoupon view={order} label={label} tokenName={asset} torn={book.torn.has(order.orderHash)} /> : <p className="caveat">No order in this run yet.</p>;

  return (
    <main className="guide" lang="en">
      <header className="guide__head">
        <img className="demo__logo" src="/design/logos/handoff-lockup-horizontal.svg" alt="Handoff" />
        <a className="wallet-link" href="#all">
          See it all at once
        </a>
      </header>

      <div className="guide__body">
        <Rail step={step} furthest={furthest} done={done} locked={locked} onGo={go} />

        <section className="guide-panel" data-direction={direction} key={stepId}>
          <div className="guide-panel__scroll">
            <h1 className="t-display-l guide-panel__title" tabIndex={-1} ref={heading}>
              {view.title}
            </h1>
            {view.body}
          </div>
          {view.action && <div className="guide-panel__action">{view.action}</div>}
        </section>

        <section className="guide-stage" data-step={stepId} aria-label="The wallets and the feed">
          <GuidePhone brand="Billetera Sur" role="Seller" venueName={VENUES[0]?.label ?? "PSAV 1"} wallet={seller} lit={isLit("seller")}>
            {coupon(order?.status === "filled" ? "Sale" : "Sell order")}
          </GuidePhone>
          <GuidePhone brand="Banco Norte" role="Buyer" venueName={VENUES[1]?.label ?? "PSAV 2"} wallet={buyer} lit={isLit("buyer")}>
            {coupon(order?.status === "filled" ? "Purchase" : "Offer")}
          </GuidePhone>
          <section className="guide-part guide-account" data-lit={isLit("unverified")} aria-label="Unverified account">
            <div className="demo-panel__head">
              <span className="t-field-label">Unverified account</span>
              <Stamp status="blocked">Unverified</Stamp>
            </div>
            <Hash value={config.unverified} href={explorerUrl("address", config.unverified)} />
            <p className="caveat">Uses no wallet: it calls the contract directly.</p>
            {refused?.result.reverted && <Stamp status="reverted">Refused</Stamp>}
          </section>
          <div className="guide-part guide-feed demo__feed" data-lit={isLit("feed")}>
            <ComplianceFeed entries={rows} />
          </div>
        </section>
      </div>

      <footer className="guide__foot">
        <p className="caveat">{caveat}</p>
        <p className="caveat">{storeNote}</p>
      </footer>
    </main>
  );
}

function GuidePhone({ brand, role, venueName, wallet, lit, children }: { brand: string; role: string; venueName: string; wallet: Wallet; lit?: boolean; children: ReactNode }) {
  const { snapshot, precheck } = wallet;
  return (
    <article className="guide-part host demo-phone guide-phone" data-lit={lit} aria-label={brand}>
      <header className="host__bar">
        <span className="host__name">{brand}</span>
        <Stamp status={precheck === "passed" ? "verified" : precheck === "blocked" ? "blocked" : "pending"} />
      </header>
      <div className="demo-phone__who">
        <span className="t-field-label">{role}</span>
        <span className="t-field-label">Operated by {venueName}</span>
        <Hash value={wallet.address} href={explorerUrl("address", wallet.address)} />
      </div>
      <dl className="guide-phone__balance">
        <div>
          <dt className="t-field-label">Tokens</dt>
          <dd>{snapshot ? formatCount(snapshot.tokens) : "-"}</dd>
        </div>
        <div>
          <dt className="t-field-label">USDC</dt>
          <dd>{snapshot ? formatUsdc(snapshot.usdc) : "-"}</dd>
        </div>
      </dl>
      <div className="host__main demo-phone__body">
        {wallet.offline && <Notice status="pending">Could not read {networkLabel}. Retrying.</Notice>}
        {children}
      </div>
      <footer className="host__foot demo-phone__foot">
        <OperatedBy />
      </footer>
    </article>
  );
}
