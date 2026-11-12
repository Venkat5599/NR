import type { Metadata } from "next";
import { SiteFooter } from "@/components/footer/SiteFooter";
import { RecordList } from "@/components/record/RecordList";
import { SectionDot } from "@/components/ui/SectionHeading";
import { LunarError } from "@/lib/errors";
import { PAY_CONTRACT, RECEIVE_CONTRACT } from "@/lib/near/lunar-pay";
import { readRecord } from "@/lib/record/read";
import type { RecordEntry } from "@/lib/record/events";

export const revalidate = 30;

export const metadata: Metadata = {
  title: "The public record · Lunar",
  description: "Every payment, refusal and recovery the Lunar contracts recorded on NEAR testnet, with transaction links.",
};

type Loaded = { kind: "ok"; entries: RecordEntry[] } | { kind: "failed"; reason: string };

async function load(): Promise<Loaded> {
  try {
    return { kind: "ok", entries: await readRecord() };
  } catch (error) {
    if (error instanceof LunarError) return { kind: "failed", reason: error.message };
    throw error;
  }
}

function contractLink(id: string) {
  return (
    <a className="link font-pixel" href={`https://testnet.nearblocks.io/address/${id}`} rel="noreferrer" target="_blank">
      {id}
    </a>
  );
}

export default async function RecordPage() {
  const loaded = await load();
  return (
    <main className="page">
      <header className="page-head">
        <div className="page-kicker font-pixel">{"Public record · NEAR testnet"}</div>
        <h1 className="text-titles-h2 page-title">{"Every save has a transaction link"}</h1>
        <SectionDot />
        <p className="text-body-x-large page-lede">
          {"Built only from what the contracts logged on chain: payments and cap refusals from "}
          {contractLink(PAY_CONTRACT)}
          {", recovery events from "}
          {contractLink(RECEIVE_CONTRACT)}
          {". "}
          <span className="text-neutral-muted">{"Refreshed every 30 seconds."}</span>
        </p>
      </header>
      <div className="page-section">
        {loaded.kind === "ok" ? (
          <RecordList entries={loaded.entries} />
        ) : (
          <p className="panel-copy record-empty">{`Couldn't read the chain right now: ${loaded.reason}`}</p>
        )}
      </div>
      <SiteFooter />
    </main>
  );
}
