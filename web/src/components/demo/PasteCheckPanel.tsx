"use client";

import { useState } from "react";
import { checkPaste, shortAddress, type Payee, type PasteVerdict } from "@/lib/pay/paste-check";

/** Payees saved on this device in the demo: a real receive address on Base Sepolia. */
const SAVED: Payee[] = [{ name: "lunar-user-80366.testnet", address: "0xa8871e9879d17e229d73c5faeff677d5a8cd2bd2" }];

const SAMPLES = [
  { label: "Saved address", text: "0xa8871e9879d17e229d73c5faeff677d5a8cd2bd2" },
  { label: "Lookalike", text: "0xa8870000c0ffee00000000000000000000002bd2" },
  { label: "New address", text: "0x1111222222222222222222222222222222223333" },
];

function verdictText(v: PasteVerdict): { tone: "ok" | "warn" | "neutral"; title: string; detail: string } {
  switch (v.kind) {
    case "known":
      return { tone: "ok", title: `Matches ${v.payee.name}`, detail: `${shortAddress(v.payee.address)} is the address you paid before` };
    case "lookalike":
      return {
        tone: "warn",
        title: "Lookalike address",
        detail: `${shortAddress(v.pasted)} starts and ends like ${v.payee.name}'s ${shortAddress(v.payee.address)} but is a different address. Don't send.`,
      };
    case "new":
      return { tone: "neutral", title: "New address", detail: `${shortAddress(v.address)} isn't one you've paid. Check it with the person.` };
    default:
      return { tone: "neutral", title: "No address", detail: "Paste one EVM address to check it" };
  }
}

/** Checks a pasted address against saved payees before anything is signed. */
export function PasteCheckPanel() {
  const [clip, setClip] = useState("");
  const verdict = clip.trim() === "" ? null : verdictText(checkPaste(clip, SAVED));
  return (
    <section className="panel" aria-labelledby="paste-title">
      <h2 className="panel-title" id="paste-title">
        {"Paste check"}
      </h2>
      <p className="panel-copy">{"Paste an address. Lunar compares it with the payees saved on this device and catches lookalikes planted in your history."}</p>
      <input
        aria-label="Pasted address"
        className="field"
        onChange={(e) => setClip(e.target.value)}
        placeholder="0x…"
        spellCheck={false}
        value={clip}
      />
      <div className="chips">
        {SAMPLES.map((s) => (
          <button className="chip" key={s.label} onClick={() => setClip(s.text)} type="button">
            {s.label}
          </button>
        ))}
      </div>
      {verdict && (
        <div className="verdict" data-tone={verdict.tone}>
          <span className="strip-dot" />
          <div>
            <div className="strip-title">{verdict.title}</div>
            <div className="strip-detail">{verdict.detail}</div>
          </div>
        </div>
      )}
      <div className="saved">
        {SAVED.map((p) => (
          <div className="saved-row" key={p.name}>
            <span>{p.name}</span>
            <span className="font-pixel">{shortAddress(p.address)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
