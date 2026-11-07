import type { Metadata } from "next";
import { FeedRow, Fields, PriceBand } from "@/design";

export const metadata: Metadata = { title: "Consola del emisor | Handoff" };

const SELLER = "0x8a1f3b7e9d204c6fa5e1b0d7c2964f18e3a7c42e";
const BUYER = "0x51c97e20ab34d8f16c0e7a92b4d3f8e6107db93a";

export default function ConsolePage() {
  return (
    <main className="console">
      <img className="console__logo" src="/design/logos/handoff-lockup-horizontal.svg" alt="Handoff" />
      <h1 className="t-display-l">Consola del emisor</h1>
      <div className="console__columns">
        <section className="console__section">
          <h2 className="t-title">Actividad</h2>
          <div>
            <FeedRow time="21:14" event="Vendido" status="sold" asset="Edificio Conectia" from={SELLER} to={BUYER} price="448,00" />
            <FeedRow time="21:02" event="Orden" status="unused" asset="Edificio Conectia" from={BUYER} price="112,00" />
            <FeedRow time="20:47" event="Cancelada" status="cancelled" asset="Edificio Conectia" from={SELLER} price="112,00" />
          </div>
        </section>
        <section className="console__section">
          <h2 className="t-title">Edificio Conectia</h2>
          <Fields
            items={[
              { label: "Tokens emitidos", value: "1.000" },
              { label: "Plataformas", value: "1 de 5" },
            ]}
          />
          <PriceBand min={104} max={116} value={112} />
        </section>
      </div>
      <p className="caveat">Atestaciones de demostración en Fuji, sin verificación de identidad.</p>
    </main>
  );
}
