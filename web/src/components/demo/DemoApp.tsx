"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cardFacts, type Tone } from "@/lib/demo/card";
import { LunarError } from "@/lib/errors";
import type { Pocket } from "@/lib/near/lunar-pay";
import { parsePay, type Token } from "@/lib/pay/parser";
import { api, ApiError } from "./api";
import { DemoKeyboard } from "./DemoKeyboard";
import { PayStrip, type StripAction } from "./PayStrip";
import { PocketPanel, type PocketState } from "./PocketPanel";

type Intent = { payee: string; amount: string; token: Token; memo: string | null; via: string };

type Strip = { title: string; lines: string[]; tone: Tone; busy?: boolean; action?: StripAction };

const EXAMPLES = ["pay lunar-69787.testnet 0.05 for coffee", "pay lunar-69787.testnet 1", "send lunar-69787.testnet a fiver for the cab"];

function explain(error: unknown): string {
  if (error instanceof ApiError || error instanceof LunarError) return error.message;
  throw error;
}

/** The demo: a text box, the pay card and the keyboard, paying from the shared testnet pocket. */
export function DemoApp() {
  const [text, setText] = useState("");
  const [strip, setStrip] = useState<Strip | null>(null);
  const [pocket, setPocket] = useState<PocketState>({ kind: "loading" });
  const generation = useRef(0);

  const loadPocket = useCallback(async () => {
    try {
      setPocket({ kind: "ready", pocket: await api.pocket() });
    } catch (error) {
      setPocket({ kind: "failed", reason: explain(error) });
    }
  }, []);

  useEffect(() => {
    void loadPocket();
  }, [loadPocket]);

  const show = (gen: number, next: Strip | null) => {
    if (gen === generation.current) setStrip(next);
  };

  const send = async (intent: Intent) => {
    const gen = ++generation.current;
    setStrip({ title: `Paying ${intent.payee} · ${intent.amount} NEAR`, lines: ["Signing with the demo's pay-only key…"], tone: "neutral", busy: true });
    try {
      const paid = await api.pay(intent.payee, intent.amount, intent.memo);
      const receipt = { label: "Receipt", href: paid.explorer };
      if (paid.result === "Sent") {
        show(gen, { title: `Sent ${paid.amount} NEAR to ${paid.to}`, lines: [`Tx ${paid.txHash.slice(0, 10)}… · tap Receipt to see it on NEAR`], tone: "ok", action: receipt });
      } else if (paid.result === "RefusedOverCap") {
        show(gen, { title: "The contract refused: over today's cap", lines: ["Nothing left the pocket · the refusal is on chain"], tone: "warn", action: receipt });
      } else {
        show(gen, { title: "The contract refused: not enough in the pocket", lines: ["Nothing left the pocket"], tone: "warn", action: receipt });
      }
      void loadPocket();
    } catch (error) {
      show(gen, { title: "Payment didn't go through", lines: [explain(error)], tone: "warn" });
    }
  };

  const readIntent = async (gen: number, sentence: string): Promise<Intent | null> => {
    const local = parsePay(sentence);
    if (local) return { ...local, via: "Read on this device" };
    show(gen, { title: "Reading the sentence…", lines: ["Asking a private model on NEAR AI Cloud"], tone: "neutral", busy: true });
    try {
      const reply = await api.parse(sentence);
      if (!reply.isPayment) {
        show(gen, { title: "That doesn't read as a payment", lines: [reply.reason], tone: "warn" });
        return null;
      }
      return { payee: reply.payee, amount: reply.amount, token: reply.token, memo: reply.memo, via: `Read by ${reply.model} on NEAR AI Cloud` };
    } catch (error) {
      const lines = error instanceof ApiError && error.status === 503 ? ["AI parsing needs NEARAI_API_KEY", "Try: pay <name> <amount> [for memo]"] : [explain(error)];
      show(gen, { title: "Couldn't read that sentence", lines, tone: "warn" });
      return null;
    }
  };

  const onPay = async () => {
    const gen = ++generation.current;
    const sentence = text.trim();
    if (sentence === "") {
      setStrip({ title: "Type a payment first", lines: [`For example: ${EXAMPLES[0] ?? ""}`], tone: "neutral" });
      return;
    }
    const intent = await readIntent(gen, sentence);
    if (!intent) return;
    const title = `Pay ${intent.payee} · ${intent.amount} ${intent.token}`;
    const memo = intent.memo ? [`For ${intent.memo}`] : [];
    if (intent.token !== "NEAR") {
      show(gen, { title: "This demo pays in NEAR", lines: [`Type  pay ${intent.payee} ${intent.amount}  without "${intent.token.toLowerCase()}"`], tone: "warn" });
      return;
    }
    show(gen, { title, lines: [`Checking ${intent.payee}…`, ...memo], tone: "neutral", busy: true });
    try {
      const [check, latest] = await Promise.all([api.nameCheck(intent.payee, intent.amount), api.pocket()]);
      setPocket({ kind: "ready", pocket: latest });
      const facts = cardFacts(intent.payee, intent.amount, check, latest, latest.account);
      const lines = [...facts.lines, ...memo, intent.via];
      const action = facts.canPay ? { label: facts.overCap ? "Pay anyway" : "Pay", onClick: () => void send(intent) } : undefined;
      show(gen, { title, lines, tone: facts.tone, ...(action ? { action } : {}) });
    } catch (error) {
      show(gen, { title, lines: [explain(error)], tone: "warn" });
    }
  };

  const close = () => {
    generation.current++;
    setStrip(null);
  };

  return (
    <div className="demo-grid">
      <div className="phone">
        <div className="phone-chat">
          <div className="bubble">{"Dinner was great! How much do I owe you?"}</div>
          <div className="bubble bubble-me">{"0.05 NEAR, thanks"}</div>
        </div>
        <div className="composer">
          <input
            aria-label="Message"
            autoCapitalize="none"
            autoComplete="off"
            className="composer-input"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void onPay();
            }}
            placeholder="pay lunar-69787.testnet 0.05 for coffee"
            spellCheck={false}
            value={text}
          />
        </div>
        <div className="kb-shell">
          {strip ? (
            <PayStrip
              action={strip.action}
              busy={strip.busy ?? false}
              lines={strip.lines}
              onClose={close}
              title={strip.title}
              tone={strip.tone}
            />
          ) : (
            <div className="strip strip-empty">{"Type a payment, then tap Pay"}</div>
          )}
          <DemoKeyboard onDelete={() => setText((t) => t.slice(0, -1))} onPay={() => void onPay()} onText={(s) => setText((t) => t + s)} />
        </div>
      </div>
      <div className="demo-side">
        <PocketPanel state={pocket} />
        <section aria-labelledby="try-title" className="panel">
          <h2 className="panel-title" id="try-title">
            {"Try"}
          </h2>
          <div className="chips">
            {EXAMPLES.map((example) => (
              <button className="chip" key={example} onClick={() => setText(example)} type="button">
                {example}
              </button>
            ))}
          </div>
          <p className="panel-copy">{"The first two are read on this device. The third needs the AI parser."}</p>
        </section>
      </div>
    </div>
  );
}
