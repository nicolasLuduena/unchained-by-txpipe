import { Amount, Hash, Stamp, type StampStatus } from "@/design";
import { explorerUrl } from "@/lib/chain";
import { share, units } from "@/lib/console/format";
import type { HolderState, TokenView } from "@/lib/console/state";

const STATE_STAMP: Record<HolderState, StampStatus> = {
  Verificado: "verified",
  Bloqueado: "blocked",
  Revertido: "reverted",
  "Sin atestación": "blocked",
  "Sin unidades": "unused",
};

export function HoldersTable({ token }: { token: TokenView }) {
  return (
    <section className="desk__section">
      <h2 className="t-title">Titulares</h2>
      {token.holders.length === 0 ? (
        <p className="t-caption">Sin titulares todavía. Emití unidades para ver el primero.</p>
      ) : (
        <table className="desk__table">
          <thead>
            <tr>
              <th scope="col">Titular</th>
              <th scope="col">Categoría de atestación</th>
              <th scope="col" className="desk__num">Unidades</th>
              <th scope="col" className="desk__num">Parte de la emisión</th>
              <th scope="col">Estado</th>
            </tr>
          </thead>
          <tbody>
            {token.holders.map((holder) => (
              <tr key={holder.address}>
                <td><Hash value={holder.address} href={explorerUrl("address", holder.address)} /></td>
                <td>{holder.category}</td>
                <td className="desk__num"><Amount value={units(holder.units)} /></td>
                <td className="desk__num"><Amount value={share(holder.units, token.totalSupply)} /></td>
                <td><Stamp status={STATE_STAMP[holder.state]}>{holder.state}</Stamp></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="caveat">Atestaciones de demostración en Fuji, sin verificación de identidad.</p>
    </section>
  );
}
