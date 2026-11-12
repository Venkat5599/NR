"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { LAYOUTS, type Key, type Page } from "./layout";

type Props = {
  onText: (text: string) => void;
  onDelete: () => void;
  onPay: () => void;
};

function Crescent() {
  return (
    <svg aria-hidden="true" fill="none" height="14" viewBox="0 0 48 48" width="14">
      <path d="M39.557 30.854A17 17 0 1 1 22.562 7.061A14.62 14.62 0 1 0 39.557 30.854Z" fill="currentColor" />
    </svg>
  );
}

/** The Lunar keyboard on screen: same rows, same Pay key, same colours as the phone. */
export function DemoKeyboard({ onText, onDelete, onPay }: Props) {
  const [page, setPage] = useState<Page>("letters");
  const [shift, setShift] = useState(false);

  const press = (k: Key) => {
    switch (k.type) {
      case "char":
        onText(shift ? k.label.toUpperCase() : k.label);
        setShift(false);
        return;
      case "space":
        onText(" ");
        return;
      case "delete":
        onDelete();
        return;
      case "shift":
        setShift(!shift);
        return;
      case "to-symbols":
        setPage("symbols");
        return;
      case "to-letters":
        setPage("letters");
        return;
      case "pay":
      case "enter":
        onPay();
        return;
      case "spacer":
        return;
    }
  };

  return (
    <div aria-label="Lunar keyboard" className="kb" role="group">
      {LAYOUTS[page].map((row, r) => (
        <div className="kb-row" key={`${page}-${r}`}>
          {row.map((k, i) =>
            k.type === "spacer" ? (
              <div aria-hidden="true" key={i} style={{ flexGrow: k.weight, flexBasis: 0 }} />
            ) : (
              <button
                aria-label={k.type === "space" ? "space" : k.type === "pay" ? "Pay" : k.label}
                className={cn("kb-key", {
                  "kb-key-mod": k.type !== "char" && k.type !== "space" && k.type !== "pay",
                  "kb-key-pay": k.type === "pay",
                  "kb-key-on": k.type === "shift" && shift,
                })}
                data-key={k.type === "char" ? k.label : k.type}
                key={i}
                onClick={() => press(k)}
                onMouseDown={(e) => e.preventDefault()}
                style={{ flexGrow: k.weight, flexBasis: 0 }}
                type="button"
              >
                {k.type === "pay" ? (
                  <span className="kb-pay-label">
                    <Crescent />
                    {"Pay"}
                  </span>
                ) : k.type === "char" && shift ? (
                  k.label.toUpperCase()
                ) : (
                  k.label
                )}
              </button>
            ),
          )}
        </div>
      ))}
    </div>
  );
}
