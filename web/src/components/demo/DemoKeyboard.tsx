"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { LAYOUTS, optionsFor, tapShift, type Key, type Page, type ShiftMode } from "@/lib/keyboard/layouts";

type Props = {
  onText: (text: string) => void;
  onDelete: () => void;
  onPay: () => void;
  onPayHold: () => void;
  onEnter: () => void;
  /** Amount fields want digits: the form switches the page for the field it is on. */
  page?: Page | undefined;
};

const HOLD_MS = 320;

function Icon({ kind }: { kind: "shift" | "shift-on" | "shift-locked" | "delete" | "return" }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const arrow = "M12 4.5 20 12.5h-4.5v5h-7v-5H4Z";
  return (
    <svg aria-hidden="true" height="22" viewBox="0 0 24 24" width="22">
      {kind === "delete" && (
        <g {...common}>
          <path d="M8.5 5.5H20v13H8.5L2.5 12Z" />
          <path d="m11.5 9.5 5 5m0-5-5 5" />
        </g>
      )}
      {kind === "return" && <path {...common} d="M19.5 5v8.5H5m4-4-4 4 4 4" />}
      {kind.startsWith("shift") && <path {...common} d={arrow} fill={kind === "shift" ? "none" : "currentColor"} />}
      {kind === "shift-locked" && <path {...common} d="M8.5 21h7" />}
    </svg>
  );
}

function Crescent() {
  return (
    <svg aria-hidden="true" fill="none" height="15" viewBox="0 0 48 48" width="15">
      <path d="M39.557 30.854A17 17 0 1 1 22.562 7.061A14.62 14.62 0 1 0 39.557 30.854Z" fill="currentColor" />
    </svg>
  );
}

type Hold = { key: Key; options: string[]; selected: number; left: number; top: number; cell: number };

/**
 * The Lunar keyboard in the browser: the phone's rows, icons and Pay key. Hold a key for its
 * options (digits, accents, currencies) and slide to pick; double-tap shift to lock capitals;
 * hold Pay for the pay form.
 */
export function DemoKeyboard({ onText, onDelete, onPay, onPayHold, onEnter, page: forcedPage }: Props) {
  const [page, setPage] = useState<Page>("letters");
  const [shift, setShift] = useState<ShiftMode>("off");
  const [hold, setHold] = useState<Hold | null>(null);
  const lastShiftTap = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);
  const board = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (forcedPage) setPage(forcedPage);
  }, [forcedPage]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const upper = page === "letters" && shift !== "off";

  const press = (k: Key) => {
    switch (k.type) {
      case "char":
        onText(upper ? k.label.toUpperCase() : k.label);
        if (shift === "once") setShift("off");
        return;
      case "space":
        onText(" ");
        return;
      case "delete":
        onDelete();
        return;
      case "shift": {
        const next = tapShift(shift, lastShiftTap.current, performance.now());
        lastShiftTap.current = next.lastTap;
        setShift(next.mode);
        return;
      }
      case "to-symbols":
        setPage("symbols");
        return;
      case "to-letters":
        setPage("letters");
        return;
      case "pay":
        onPay();
        return;
      case "enter":
        onEnter();
        return;
      case "spacer":
        return;
    }
  };

  const startHold = (k: Key, el: HTMLElement) => {
    fired.current = false;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (k.type === "pay") {
        fired.current = true;
        onPayHold();
        return;
      }
      const options = optionsFor(k, upper);
      if (options.length === 0 || !board.current) return;
      fired.current = true;
      if (options.length === 1) {
        onText(options[0] ?? "");
        return;
      }
      const b = board.current.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const cell = Math.max(r.width, 38);
      const width = options.reduce((w, o) => w + Math.max(cell, o.length * 10 + 20), 0);
      const left = Math.min(Math.max(4, r.left - b.left), b.width - width - 4);
      setHold({ key: k, options, selected: 0, left, top: r.top - b.top - r.height - 8, cell });
    }, HOLD_MS);
  };

  const cellIndexAt = (h: Hold, x: number) => {
    let edge = h.left;
    for (let i = 0; i < h.options.length; i++) {
      edge += Math.max(h.cell, (h.options[i] ?? "").length * 10 + 20);
      if (x < edge) return i;
    }
    return h.options.length - 1;
  };

  const endHold = (k: Key, commit: boolean) => {
    if (timer.current) clearTimeout(timer.current);
    if (hold) {
      if (commit) onText(hold.options[hold.selected] ?? "");
      setHold(null);
      return;
    }
    if (commit && !fired.current) press(k);
  };

  return (
    <div aria-label="Lunar keyboard" className="kb" ref={board} role="group">
      {hold && (
        <div className="kb-pop" role="listbox" style={{ left: hold.left, top: hold.top }}>
          {hold.options.map((o, i) => (
            <span
              aria-selected={i === hold.selected}
              className={cn("kb-pop-cell", { "kb-pop-on": i === hold.selected })}
              key={o}
              onPointerUp={() => {
                onText(o);
                setHold(null);
              }}
              role="option"
              style={{ minWidth: hold.cell }}
            >
              {o}
            </span>
          ))}
        </div>
      )}
      {LAYOUTS[page].map((row, r) => (
        <div className="kb-row" key={`${page}-${r}`}>
          {row.map((k, i) =>
            k.type === "spacer" ? (
              <div aria-hidden="true" key={i} style={{ flexGrow: k.weight, flexBasis: 0 }} />
            ) : (
              <button
                aria-label={k.type === "space" ? "space" : k.type === "pay" ? "Pay" : k.type === "enter" ? "enter" : k.type === "delete" ? "delete" : k.type === "shift" ? `shift ${shift}` : k.label}
                className={cn("kb-key", {
                  "kb-key-mod": k.type !== "char" && k.type !== "space" && k.type !== "pay",
                  "kb-key-pay": k.type === "pay",
                  "kb-key-on": k.type === "shift" && shift !== "off",
                })}
                data-key={k.type === "char" ? k.label : k.type}
                key={i}
                onContextMenu={(e) => e.preventDefault()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    press(k);
                  }
                }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
                  startHold(k, e.currentTarget);
                }}
                onPointerLeave={() => {
                  if (!hold && timer.current) clearTimeout(timer.current);
                }}
                onPointerMove={(e) => {
                  if (!hold || !board.current) return;
                  const x = e.clientX - board.current.getBoundingClientRect().left;
                  const sel = cellIndexAt(hold, x);
                  if (sel !== hold.selected) setHold({ ...hold, selected: sel });
                }}
                onPointerUp={() => endHold(k, true)}
                style={{ flexGrow: k.weight, flexBasis: 0 }}
                type="button"
              >
                {k.type === "pay" ? (
                  <span className="kb-pay-label">
                    <Crescent />
                    {"Pay"}
                  </span>
                ) : k.type === "shift" ? (
                  <Icon kind={shift === "off" ? "shift" : shift === "once" ? "shift-on" : "shift-locked"} />
                ) : k.type === "delete" ? (
                  <Icon kind="delete" />
                ) : k.type === "enter" ? (
                  <Icon kind="return" />
                ) : k.type === "space" ? (
                  <span className="kb-space-label">{"Lunar"}</span>
                ) : (
                  <>
                    {upper && k.type === "char" ? k.label.toUpperCase() : k.label}
                    {k.hint && page === "letters" && <span className="kb-hint">{k.hint}</span>}
                  </>
                )}
              </button>
            ),
          )}
        </div>
      ))}
    </div>
  );
}
