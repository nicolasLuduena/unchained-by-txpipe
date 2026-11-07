import { Amount, Hash, Stamp, type StampStatus } from "@/design";
import { explorerUrl } from "@/lib/chain";
import { share, units } from "@/lib/console/format";
import type { HolderState, TokenView } from "@/lib/console/state";

const STATE_STAMP: Record<HolderState, StampStatus> = {
  Verified: "verified",
  Blocked: "blocked",
  "On paper": "verified",
  "No attestation": "blocked",
  "No units": "unused",
};

export function HoldersTable({ token }: { token: TokenView }) {
  return (
    <section className="desk__section">
      <h2 className="t-title">Holders</h2>
      <p className="t-caption desk__sub">Who holds units of this token, and whether they can trade.</p>
      {token.holders.length === 0 ? (
        <p className="t-caption">No holders yet. Issue units to see the first one.</p>
      ) : (
        <table className="desk__table">
          <thead>
            <tr>
              <th scope="col">Holder</th>
              <th scope="col">Attestation category</th>
              <th scope="col" className="desk__num">Units</th>
              <th scope="col" className="desk__num">Share of issuance</th>
              <th scope="col">State</th>
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
    </section>
  );
}
