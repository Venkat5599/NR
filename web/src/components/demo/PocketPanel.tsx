import type { Pocket } from "@/lib/near/lunar-pay";

export type PocketState = { kind: "loading" } | { kind: "ready"; pocket: Pocket } | { kind: "failed"; reason: string };

/** The shared demo pocket as the payments contract reports it right now. */
export function PocketPanel({ state }: { state: PocketState }) {
  return (
    <section aria-labelledby="pocket-title" className="panel">
      <h2 className="panel-title" id="pocket-title">
        {"Demo pocket"}
      </h2>
      {state.kind === "loading" && <p className="panel-copy">{"Reading the contract…"}</p>}
      {state.kind === "failed" && <p className="panel-copy">{`Couldn't read the pocket: ${state.reason}`}</p>}
      {state.kind === "ready" && (
        <>
          <p className="panel-copy">
            {"Shared testnet account "}
            <a className="link" href={`https://testnet.nearblocks.io/address/${state.pocket.account}`} rel="noreferrer" target="_blank">
              {state.pocket.account}
            </a>
            {". Its key here can call pay on the payments contract and nothing else."}
          </p>
          <dl className="stats">
            <div>
              <dt>{"Left today"}</dt>
              <dd>{`${state.pocket.leftToday} NEAR`}</dd>
            </div>
            <div>
              <dt>{"Daily cap"}</dt>
              <dd>{`${state.pocket.dailyCap} NEAR`}</dd>
            </div>
            <div>
              <dt>{"In the pocket"}</dt>
              <dd>{`${state.pocket.balance} NEAR`}</dd>
            </div>
          </dl>
        </>
      )}
    </section>
  );
}
