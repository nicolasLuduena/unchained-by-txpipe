import { Amount, Coupon, Notice, OperatedBy, Stamp } from "@/design";

export default function WalletPage() {
  return (
    <div className="host">
      <header className="host__bar">
        <span className="host__name">Billetera Sur</span>
        <Stamp status="verified" />
      </header>
      <main className="host__main">
        <section className="host__balance">
          <span className="t-field-label">Saldo disponible</span>
          <Amount value="3.418,00" currency="USDC" size="l" />
        </section>
        <Coupon
          label="Orden de venta"
          number="N.º 0142"
          title="Edificio Conectia"
          fields={[
            { label: "Cantidad", value: "4 tokens" },
            { label: "Precio", value: "USDC 112,00" },
          ]}
          note="Tus tokens quedan en tu billetera hasta que alguien acepte."
          total="448,00"
        />
        <Notice status="sponsored">Vendés sin pagar gas.</Notice>
        <p className="caveat">Atestaciones de demostración en Fuji, sin verificación de identidad.</p>
      </main>
      <footer className="host__foot">
        <OperatedBy />
      </footer>
    </div>
  );
}
