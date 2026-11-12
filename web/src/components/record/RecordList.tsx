import { explorerTx } from "@/lib/near/name";
import type { RecordEntry, RecordEvent } from "@/lib/record/events";

const LABELS: Record<RecordEvent, string> = {
  pay: "Sent",
  refused_over_cap: "Refused · over cap",
  refused_low_balance: "Refused · low balance",
  pay_failed_refunded: "Bounced · refunded",
  registered: "Receive address",
  transfer_checked: "Transfer checked",
  transfer_verified: "Transfer verified",
  transfer_signed: "Return signed",
  transfer_rejected: "Transfer refused",
  recovery_refused: "Recovery refused",
};

const SAVES: readonly RecordEvent[] = ["refused_over_cap", "refused_low_balance", "pay_failed_refunded", "transfer_rejected", "recovery_refused"];

function when(ms: number): string {
  return `${new Date(ms).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

/** Chain events, newest first, each linking to its transaction. */
export function RecordList({ entries }: { entries: RecordEntry[] }) {
  if (entries.length === 0) return <p className="panel-copy record-empty">{"Nothing yet"}</p>;
  const saves = entries.filter((e) => SAVES.includes(e.event)).length;
  return (
    <>
      <div className="record-count text-body-small text-neutral-muted">{`${entries.length} events · ${saves} refusals`}</div>
      <ol className="record">
        {entries.map((e, i) => (
          <li className="record-row" data-save={SAVES.includes(e.event) ? "yes" : "no"} key={`${e.txHash}-${e.event}-${i}`}>
            <span className="record-tag">{LABELS[e.event]}</span>
            <span className="record-summary">{e.summary}</span>
            <span className="record-meta">
              <span>{when(e.at)}</span>
              <a className="link font-pixel" href={explorerTx(e.txHash)} rel="noreferrer" target="_blank">
                {`${e.txHash.slice(0, 8)}…`}
              </a>
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}
