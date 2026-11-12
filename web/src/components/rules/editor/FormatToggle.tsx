"use client";

import { motion } from "motion/react";
import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Tooltip } from "./Tooltip";

type Props = { label: string; onToggle: (active: boolean) => void; children: ReactNode };

const pressTo = (element: HTMLElement | null, scale: number) => {
  element?.animate({ scale }, { duration: 100, easing: "ease-in-out", fill: "forwards" });
};

/** A bold / italic / underline style toggle. */
export function FormatToggle({ label, onToggle, children }: Props) {
  const [hovered, setHovered] = useState(false);
  const [active, setActive] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <Tooltip content={label}>
      <button
        className={cn("size-28 flex-center rounded-6 relative transition", {
          "text-neutral-muted hover:text-neutral-default": !active,
          "text-neutral-default": active,
        })}
        onClick={() => {
          onToggle(!active);
          setActive(!active);
        }}
        onMouseDown={() => pressTo(ref.current, 0.95)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onMouseUp={() => pressTo(ref.current, 1)}
        ref={ref}
      >
        <motion.div
          animate={{ opacity: hovered ? 1 : 0, scale: hovered ? 1 : 0.95, transition: { stiffness: 200, damping: 17, type: "spring" } }}
          className="absolute inset-0 rounded-6 bg-neutral-faint-6 pointer-events-none"
        />
        {children}
      </button>
    </Tooltip>
  );
}
