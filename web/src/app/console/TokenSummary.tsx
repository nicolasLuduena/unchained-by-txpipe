import { Fields, Hash, PriceBand, Stamp } from "@/design";
import { explorerUrl } from "@/lib/chain";
import { units, usdc } from "@/lib/console/format";
import type { TokenView } from "@/lib/console/state";

const MAX_VENUES = 5;
const toNumber = (base: bigint) => Number(base) / 1e6;

function tradingWord(token: TokenView): string {
  if (token.paused) return "Paused";
  return token.tradingEnabled ? "Open" : "Closed";
}

export function TokenSummary({ token }: { token: TokenView }) {
  const reference = toNumber(token.band.price);
  const half = (reference * token.band.widthBps) / 10_000;
  const holders = token.holders.filter((h) => h.units > 0n).length;

  return (
    <section className="desk__section">
      <div className="desk__titled">
        <h2 className="desk__token-name">{token.name}</h2>
        <Hash value={token.address} href={explorerUrl("address", token.address)} />
      </div>
      <Fields
        className="desk__fields"
        items={[
          { label: "Units issued", value: `${units(token.totalSupply)} of ${units(token.authorizedSupply)}` },
          { label: "Holders", value: String(holders) },
          { label: "Open orders", value: String(token.openOrders) },
          { label: "Trading", value: tradingWord(token) },
          { label: "Floor", value: token.floor > 0n ? `USDC ${usdc(token.floor)}` : "No floor" },
          { label: "Venues", value: `${token.venues.length} of ${MAX_VENUES}` },
        ]}
      />
      <dl className="desk__refs t-caption">
        <dt>CNV authorization</dt>
        <dd>{token.cnvAuthRef}</dd>
        <dt>Deposit</dt>
        <dd>{token.depositRef}</dd>
        <dt>Issuance document</dt>
        <dd><Hash value={token.issuanceDocHash} /></dd>
      </dl>
      <div className="desk__split">
        <div className="desk__section">
          <h3 className="t-label">Price band</h3>
          <p className="t-caption desk__sub">The contract refuses orders outside this band.</p>
          {token.band.price > 0n ? (
            <PriceBand min={reference - half} max={reference + half} value={reference} />
          ) : (
            <p className="t-caption">No band. Trading stays closed until one is set.</p>
          )}
        </div>
        <div className="desk__section">
          <h3 className="t-label">Venues</h3>
          <p className="t-caption desk__sub">The PSAVs that can run this token, each with its order key.</p>
          <ol className="desk__venues">
            {Array.from({ length: MAX_VENUES }, (_, slot) => {
              const entry = token.venues[slot];
              return (
                <li key={slot}>
                  <span className="desk__slot">{slot + 1}</span>
                  {entry ? (
                    <>
                      <Hash value={entry.venue} href={explorerUrl("address", entry.venue)} />
                      <span className="t-caption">order key</span>
                      <Hash value={entry.orderKey} />
                    </>
                  ) : (
                    <Stamp status="unused">Free</Stamp>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
