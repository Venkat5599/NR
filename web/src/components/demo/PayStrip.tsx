"use client";

import { cn } from "@/lib/cn";
import type { Tone } from "@/lib/demo/card";

export type StripAction = { label: string; onClick: () => void } | { label: string; href: string };

type Props = {
  title: string;
  lines: string[];
  tone: Tone;
  busy?: boolean;
  action?: StripAction | undefined;
  onClose?: (() => void) | undefined;
};

/** The card above the keys: a status dot, what Lunar found, and one action. */
export function PayStrip({ title, lines, tone, busy = false, action, onClose }: Props) {
  return (
    <div aria-live="polite" className="strip" data-tone={tone}>
      <span className={cn("strip-dot", { "strip-dot-busy": busy })} />
      <div className="strip-text">
        <div className="strip-title">{title}</div>
        {lines.map((line) => (
          <div className="strip-detail" key={line}>
            {line}
          </div>
        ))}
      </div>
      {action &&
        ("href" in action ? (
          <a className="strip-action" href={action.href} rel="noreferrer" target="_blank">
            {action.label}
          </a>
        ) : (
          <button className="strip-action" onClick={action.onClick} type="button">
            {action.label}
          </button>
        ))}
      {onClose && (
        <button aria-label="Close" className="strip-close" onClick={onClose} type="button">
          <svg aria-hidden="true" height="16" viewBox="0 0 24 24" width="16">
            <path d="M6.5 6.5l11 11m0-11-11 11" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
          </svg>
        </button>
      )}
    </div>
  );
}
