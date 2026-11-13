"use client";

import { cn } from "@/lib/cn";
import type { Field, PayForm } from "@/lib/keyboard/pay-form";

type Props = {
  form: PayForm;
  /** A problem to fix (warn colour) or the amount in dollars (muted). */
  note: { text: string; warn: boolean } | null;
  names: readonly string[];
  onField: (f: Field) => void;
  onToken: () => void;
  onName: (name: string) => void;
  onReview: () => void;
  onClose: () => void;
};

function FieldBox({ value, hint, active, onClick, label }: { value: string; hint: string; active: boolean; onClick: () => void; label: string }) {
  return (
    <button aria-label={label} aria-pressed={active} className={cn("pf-field", { "pf-field-on": active })} onClick={onClick} type="button">
      {value === "" ? (
        <>
          {active && <span className="pf-caret" />}
          <span className="pf-hint">{hint}</span>
        </>
      ) : (
        <>
          <span className="pf-value">{value}</span>
          {active && <span className="pf-caret" />}
        </>
      )}
    </button>
  );
}

/** The pay form above the keys: To, Amount with its currency, What for, and Review. */
export function PayFormPanel({ form, note, names, onField, onToken, onName, onReview, onClose }: Props) {
  return (
    <div className="pf" data-testid="pay-form">
      <div className="pf-row">
        <FieldBox active={form.active === "to"} hint="To · name.testnet" label="To" onClick={() => onField("to")} value={form.to} />
        <button aria-label="Close the pay form" className="pf-close" onClick={onClose} type="button">
          <svg aria-hidden="true" height="16" viewBox="0 0 24 24" width="16">
            <path d="M6.5 6.5l11 11m0-11-11 11" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
          </svg>
        </button>
      </div>
      <div className="pf-row">
        <FieldBox active={form.active === "amount"} hint="Amount" label="Amount" onClick={() => onField("amount")} value={form.amount} />
        <button aria-label="Currency" className="pf-token" onClick={onToken} type="button">
          {form.token}
          <svg aria-hidden="true" height="14" viewBox="0 0 24 24" width="14">
            <path d="M7 9.5l5 5 5-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
          </svg>
        </button>
        <FieldBox active={form.active === "memo"} hint="What for" label="What for" onClick={() => onField("memo")} value={form.memo} />
        <button className="pf-review" onClick={onReview} type="button">
          {"Review"}
        </button>
      </div>
      {note && <div className={cn("pf-note", { "pf-note-warn": note.warn })}>{note.text}</div>}
      {names.length > 0 && (
        <div className="pf-names">
          {names.map((n) => (
            <button className="bar-chip" key={n} onClick={() => onName(n)} type="button">
              {n}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
