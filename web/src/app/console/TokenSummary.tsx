import { Fields, Hash, PriceBand, Stamp } from "@/design";
import { explorerUrl } from "@/lib/chain";
import { units, usdc } from "@/lib/console/format";
import type { TokenView } from "@/lib/console/state";

const MAX_VENUES = 5;
const toNumber = (base: bigint) => Number(base) / 1e6;

function tradingWord(token: TokenView): string {
  if (token.paused) return "Pausado";
  return token.tradingEnabled ? "Abierta" : "Cerrada";
}

export function TokenSummary({ token }: { token: TokenView }) {
  const reference = toNumber(token.band.price);
  const half = (reference * token.band.widthBps) / 10_000;
  const holders = token.holders.filter((h) => h.units > 0n).length;

  return (
    <section className="desk__section">
      <div className="desk__titled">
        <h2 className="t-title">{token.name}</h2>
        <Hash value={token.address} href={explorerUrl("address", token.address)} />
      </div>
      <Fields
        className="desk__fields"
        items={[
          { label: "Unidades emitidas", value: `${units(token.totalSupply)} de ${units(token.authorizedSupply)}` },
          { label: "Titulares", value: String(holders) },
          { label: "Órdenes abiertas", value: String(token.openOrders) },
          { label: "Negociación", value: tradingWord(token) },
          { label: "Piso", value: token.floor > 0n ? `USDC ${usdc(token.floor)}` : "Sin piso" },
          { label: "Plataformas", value: `${token.venues.length} de ${MAX_VENUES}` },
        ]}
      />
      <dl className="desk__refs t-caption">
        <dt>Autorización CNV</dt>
        <dd>{token.cnvAuthRef}</dd>
        <dt>Depósito</dt>
        <dd>{token.depositRef}</dd>
        <dt>Documento de emisión</dt>
        <dd><Hash value={token.issuanceDocHash} /></dd>
      </dl>
      <div className="desk__split">
        <div className="desk__section">
          <h3 className="t-label">Banda de precio</h3>
          {token.band.price > 0n ? (
            <PriceBand min={reference - half} max={reference + half} value={reference} />
          ) : (
            <p className="t-caption">Sin banda. No se puede operar hasta fijarla.</p>
          )}
        </div>
        <div className="desk__section">
          <h3 className="t-label">Plataformas</h3>
          <ol className="desk__venues">
            {Array.from({ length: MAX_VENUES }, (_, slot) => {
              const entry = token.venues[slot];
              return (
                <li key={slot}>
                  <span className="desk__slot">{slot + 1}</span>
                  {entry ? (
                    <>
                      <Hash value={entry.venue} href={explorerUrl("address", entry.venue)} />
                      <span className="t-caption">clave</span>
                      <Hash value={entry.orderKey} />
                    </>
                  ) : (
                    <Stamp status="unused">Libre</Stamp>
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
