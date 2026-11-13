"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cardFacts, type Tone } from "@/lib/demo/card";
import { LunarError } from "@/lib/errors";
import { checkForm, choosePayee, cycleToken, deleteFrom, emptyForm, next, setAmount, typeInto, type Field, type PayForm } from "@/lib/keyboard/pay-form";
import { currentWord, lastSentence, readChips, showPrice, Suggest, usdOf, type Chip, type Prices } from "@/lib/keyboard/suggest";
import { parsePay, type Token } from "@/lib/pay/parser";
import { api, ApiError } from "./api";
import { DemoKeyboard } from "./DemoKeyboard";
import { PayFormPanel } from "./PayFormPanel";
import { PayStrip, type StripAction } from "./PayStrip";
import { PocketPanel, type PocketState } from "./PocketPanel";
import { SuggestionBar } from "./SuggestionBar";

type Intent = { payee: string; amount: string; token: Token; memo: string | null; via: string };

type Strip = { title: string; lines: string[]; tone: Tone; busy?: boolean; action?: StripAction };

type Theme = "light" | "dark";

const EXAMPLES = [
  "pay lunar-69787.testnet 0.05 for coffee",
  "send lunar-69787.testnet a fiver for the cab",
  "dinner was $12, i owe you",
  "can you swap 2 near to usdc",
];

const PAYEES = ["lunar-69787.testnet"];

function explain(error: unknown): string {
  if (error instanceof ApiError || error instanceof LunarError) return error.message;
  throw error;
}

/**
 * The demo phone: a chat box, the bar above the keys (suggestions, the pay card or the pay
 * form) and the keyboard, paying from the shared testnet pocket with a pay-only key.
 */
export function DemoApp() {
  const [text, setText] = useState("");
  const [strip, setStrip] = useState<Strip | null>(null);
  const [form, setForm] = useState<PayForm | null>(null);
  const [formProblem, setFormProblem] = useState<string | null>(null);
  const [pocket, setPocket] = useState<PocketState>({ kind: "loading" });
  const [prices, setPrices] = useState<Prices>({});
  const [suggest, setSuggest] = useState<Suggest | null>(null);
  const [theme, setTheme] = useState<Theme>("light");
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
    const loadPrices = () =>
      api.prices().then(
        (t) => setPrices(t.prices),
        () => undefined, // prices are optional: chips and dollar lines simply don't appear
      );
    void loadPrices();
    const timer = setInterval(() => void loadPrices(), 60_000);
    void fetch("/words_en.txt")
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`words ${r.status}`))))
      .then((t) => setSuggest(new Suggest(t.split("\n").filter(Boolean))))
      .catch(() => undefined); // without the list the bar shows chips only
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) setTheme("dark");
    return () => clearInterval(timer);
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

  /** The checked card for a payment, from any route in: the sentence, the AI, the form or a chip. */
  const showCard = async (gen: number, intent: Intent) => {
    const title = `Pay ${intent.payee} · ${intent.amount} ${intent.token}`;
    const memo = intent.memo ? [`For ${intent.memo}`] : [];
    if (intent.token !== "NEAR") {
      show(gen, { title: "This demo pays in NEAR", lines: [`${intent.token} payments need mainnet. Switch the currency to NEAR to try it on testnet.`], tone: "warn" });
      return;
    }
    const usd = usdOf(intent.amount, "NEAR", prices);
    const usdLine = usd ? [`≈ ${usd} at today's price`] : [];
    show(gen, { title, lines: [`Checking ${intent.payee}…`, ...usdLine, ...memo], tone: "neutral", busy: true });
    try {
      const [check, latest] = await Promise.all([api.nameCheck(intent.payee, intent.amount), api.pocket()]);
      setPocket({ kind: "ready", pocket: latest });
      const facts = cardFacts(intent.payee, intent.amount, check, latest, latest.account);
      const lines = [...facts.lines, ...usdLine, ...memo, intent.via];
      const action = facts.canPay ? { label: facts.overCap ? "Pay anyway" : "Pay", onClick: () => void send(intent) } : undefined;
      show(gen, { title, lines, tone: facts.tone, ...(action ? { action } : {}) });
    } catch (error) {
      show(gen, { title, lines: [explain(error)], tone: "warn" });
    }
  };

  const readIntent = async (gen: number, sentence: string): Promise<Intent | null> => {
    const local = parsePay(sentence);
    if (local) return { ...local, via: "Read on this device" };
    show(gen, { title: "Reading the sentence…", lines: ["Asking a private model on NEAR AI Cloud"], tone: "neutral", busy: true });
    try {
      const reply = await api.parse(sentence);
      if (!reply.isPayment) {
        show(gen, { title: "That doesn't read as a payment", lines: [reply.reason], tone: "warn", action: { label: "Pay form", onClick: () => openForm() } });
        return null;
      }
      return { payee: reply.payee, amount: reply.amount, token: reply.token, memo: reply.memo, via: `Read by ${reply.model} on NEAR AI Cloud` };
    } catch (error) {
      show(gen, { title: "Couldn't read that sentence", lines: [explain(error)], tone: "warn", action: { label: "Pay form", onClick: () => openForm() } });
      return null;
    }
  };

  const openForm = (payee?: string, amount?: string) => {
    generation.current++;
    setStrip(null);
    let f = emptyForm();
    if (amount) f = setAmount(f, amount);
    if (payee) f = choosePayee(f, payee);
    setForm(f);
    setFormProblem(null);
  };

  const onPay = async () => {
    if (form) return review();
    const sentence = lastSentence(text);
    if (sentence === "") return openForm();
    const gen = ++generation.current;
    const intent = await readIntent(gen, sentence);
    if (intent) await showCard(gen, intent);
  };

  const review = () => {
    if (!form) return;
    const c = checkForm(form);
    if (!c.ok) {
      setForm({ ...form, active: c.field });
      setFormProblem(c.message);
      return;
    }
    setForm(null);
    const gen = ++generation.current;
    void showCard(gen, { payee: c.payee, amount: c.amount, token: c.token, memo: c.memo, via: "From the pay form" });
  };

  const showSwap = async (amount: string, to: "USDC" | "USDT") => {
    const gen = ++generation.current;
    setStrip({ title: `Swap ${amount} NEAR to ${to}`, lines: ["Getting a quote…"], tone: "neutral", busy: true });
    try {
      const q = await api.swapQuote(amount, to);
      show(gen, {
        title: `Swap ${amount} NEAR to ${to}`,
        lines: [
          ...(q.marketUsd ? [`Market: ${amount} NEAR ≈ $${q.marketUsd} (NEAR Intents)`] : []),
          `Testnet pool: ≈ ${q.out} test-${q.to} (Ref Finance, live)`,
          "On the phone the wallet screen signs it; this demo's key can only pay",
        ],
        tone: "neutral",
        action: { label: "A real swap", href: q.recordedSwap },
      });
    } catch (error) {
      show(gen, { title: `Swap ${amount} NEAR to ${to}`, lines: [explain(error)], tone: "warn" });
    }
  };

  const onChip = (c: Chip) => {
    switch (c.kind) {
      case "pay-name":
        if (c.amount) {
          const gen = ++generation.current;
          void showCard(gen, { payee: c.name, amount: c.amount, token: "NEAR", memo: null, via: "From a name in the chat" });
        } else openForm(c.name);
        return;
      case "pay":
        openForm(undefined, c.amount ?? undefined);
        return;
      case "convert":
        openForm(undefined, c.near);
        return;
      case "swap":
        void showSwap(c.amount ?? "1", c.to);
        return;
      case "price":
        setText((t) => `${t.trimEnd()} ${c.symbol} is $${c.usd} right now`);
        return;
    }
  };

  const typeText = (s: string) => {
    if (form) {
      setForm(typeInto(form, s));
      setFormProblem(null);
      return;
    }
    // "5" then NEAR from the $ key reads as "5 NEAR"
    setText((t) => (s.length > 1 && /[\p{L}\d]$/u.test(t) ? `${t} ${s}` : t + s));
  };

  const pickWord = (w: string) => {
    setText((t) => t.slice(0, t.length - currentWord(t).length) + w + " ");
  };

  const close = () => {
    generation.current++;
    setStrip(null);
  };

  const word = currentWord(text);
  const chips = useMemo(() => readChips(lastSentence(text), prices), [text, prices]);
  const words = useMemo(() => (suggest ? suggest.words(word) : []), [suggest, word]);
  const nearPrice = prices["NEAR"];
  const leftToday = pocket.kind === "ready" ? `${pocket.pocket.leftToday} NEAR left today` : "";
  const idle = [nearPrice ? `NEAR $${showPrice(nearPrice)}` : null, leftToday || null].filter(Boolean).join(" · ");
  const formUsd = form && Number(form.amount) > 0 ? usdOf(form.amount, form.token, prices) : null;
  const formNote = formProblem
    ? { text: formProblem, warn: true }
    : formUsd && form
      ? { text: `${form.amount} ${form.token} ≈ ${formUsd} at today's price`, warn: false }
      : null;

  return (
    <div className="demo-grid">
      <div className="phone" data-theme={theme}>
        <div className="phone-chat">
          <div className="bubble">{"Dinner was great! How much do I owe you?"}</div>
          <div className="bubble bubble-me">{"$12 each, thanks"}</div>
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
            placeholder="Message"
            spellCheck={false}
            value={text}
          />
        </div>
        <div className="kb-shell">
          {form ? (
            <PayFormPanel
              form={form}
              names={PAYEES}
              note={formNote}
              onClose={() => setForm(null)}
              onField={(f: Field) => {
                setForm({ ...form, active: f });
                setFormProblem(null);
              }}
              onName={(n) => setForm(choosePayee(form, n))}
              onReview={review}
              onToken={() => setForm(cycleToken(form))}
            />
          ) : strip ? (
            <PayStrip action={strip.action} busy={strip.busy ?? false} lines={strip.lines} onClose={close} title={strip.title} tone={strip.tone} />
          ) : (
            <SuggestionBar
              actions={chips.map((c) => ({ label: c.label, onClick: () => onChip(c) }))}
              idle={idle}
              onNewPayment={() => openForm()}
              onWord={pickWord}
              words={words}
            />
          )}
          <DemoKeyboard
            onDelete={() => {
              if (form) {
                setForm(deleteFrom(form));
                setFormProblem(null);
              } else setText((t) => t.slice(0, -1));
            }}
            onEnter={() => {
              if (form) {
                const n = next(form);
                if (n.review) review();
                else setForm(n.form);
              } else void onPay();
            }}
            onPay={() => void onPay()}
            onPayHold={() => openForm()}
            onText={typeText}
            page={form ? (form.active === "amount" ? "symbols" : "letters") : undefined}
          />
        </div>
      </div>
      <div className="demo-side">
        <PocketPanel state={pocket} />
        <section aria-labelledby="try-title" className="panel">
          <div className="panel-head">
            <h2 className="panel-title" id="try-title">
              {"Try"}
            </h2>
            <div className="seg" role="group" aria-label="Keyboard theme">
              {(["light", "dark"] as const).map((t) => (
                <button aria-pressed={theme === t} className="seg-btn" key={t} onClick={() => setTheme(t)} type="button">
                  {t === "light" ? "Light" : "Dark"}
                </button>
              ))}
            </div>
          </div>
          <div className="chips">
            {EXAMPLES.map((example) => (
              <button className="chip" key={example} onClick={() => setText(example)} type="button">
                {example}
              </button>
            ))}
          </div>
          <ul className="panel-list">
            <li>{"Tap Pay with nothing typed for the pay form; hold Pay to open it any time."}</li>
            <li>{"Hold $ on the 123 page for currencies; hold a letter for accents and digits."}</li>
            <li>{"Double-tap shift to lock capitals. Words and actions show up above the keys as you type."}</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
