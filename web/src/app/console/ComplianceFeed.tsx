import type { Hash as TxHash } from "viem";
import { FeedRow, Hash } from "@/design";
import { explorerUrl } from "@/lib/chain";
import type { FeedEntry } from "@/lib/console/feed";
import { clock, fullTime } from "@/lib/console/format";
import { reasonText } from "@/lib/console/reasons";

function Entry({ entry }: { entry: FeedEntry }) {
  const refused = entry.event === "Refused";
  return (
    <div className="desk__entry">
      <FeedRow
        className={entry.fromRole ? "desk__feedrow--relabel" : undefined}
        time={entry.at ? clock(entry.at) : "-"}
        event={entry.event}
        status={entry.status}
        asset={entry.asset}
        from={entry.from}
        to={entry.to}
        price={entry.price}
        currency={entry.unit}
      />
      <p className="desk__meta t-caption" title={entry.at ? fullTime(entry.at) : undefined}>
        {entry.fromRole ? <span>{entry.fromRole}</span> : null}
        <code className="desk__code">{entry.code}</code>
        {entry.hash ? <Hash value={entry.hash} href={explorerUrl("tx", entry.hash as TxHash)} /> : <span>No transaction</span>}
        {refused ? <span>{reasonText(entry.code)}</span> : null}
        {entry.detail ? <span>{entry.detail}</span> : null}
      </p>
    </div>
  );
}

export function ComplianceFeed({ entries }: { entries: FeedEntry[] }) {
  return (
    <section className="desk__section">
      <h2 className="t-title">Compliance feed</h2>
      <p className="t-caption desk__sub">What the PSAV's compliance officer reads: contract events and order service refusals, newest first.</p>
      <div className="desk__feed">
        {entries.length === 0 ? <p className="t-caption desk__empty">No activity yet.</p> : entries.map((entry) => <Entry key={entry.id} entry={entry} />)}
      </div>
    </section>
  );
}
