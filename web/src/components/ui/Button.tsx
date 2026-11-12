"use client";

import { motion, type HTMLMotionProps } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Size = "medium" | "large" | "xlarge";
type Variant = "primary" | "secondary";

type Props = Omit<HTMLMotionProps<"button">, "children"> & {
  size?: Size;
  variant?: Variant;
  children: ReactNode;
};

function PrimaryBackground() {
  return (
    <div className="overlay bg-black/56 button-background transition-all duration-[200ms] group-active:duration-[50ms]">
      <div
        className="overlay opacity-12 group-hover:opacity-16 group-active:opacity-0 transition group-active:duration-[50ms] duration-[200ms]"
        style={{ background: "linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0.00) 100%)" }}
      />
      <div
        className="overlay opacity-32 group-active:opacity-44 transition group-active:duration-[50ms] duration-[200ms]"
        style={{ background: "radial-gradient(65.62% 65.62% at 50% 50%, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0.00) 100%)" }}
      />
      <div
        className="overlay mask-border opacity-24 p-1"
        style={{ background: "linear-gradient(180deg, #fff 0%, #999999 55%, #fff 80%, #999999 95%)" }}
      />
    </div>
  );
}

function SecondaryBackground() {
  return (
    <div className="overlay bg-white/90 button-background transition-all duration-[200ms] group-active:duration-[50ms]">
      <div className="overlay bg-black/6 group-hover:bg-black/3 group-active:bg-black/7 transition group-active:duration-[50ms] duration-[200ms]" />
      <div
        className="overlay opacity-32 group-active:opacity-0 transition group-active:duration-[50ms] duration-[200ms]"
        style={{ background: "linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0.00) 100%)" }}
      />
      <div
        className="overlay opacity-8 group-active:opacity-12 transition group-active:duration-[50ms] duration-[200ms]"
        style={{ background: "radial-gradient(65.62% 65.62% at 50% 50%, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0.00) 100%)" }}
      />
      <div
        className="overlay group-active:opacity-0 transition group-active:duration-[50ms] duration-[200ms]"
        style={{
          background:
            "linear-gradient(99deg, rgba(255, 255, 255, 0.00) 27.7%, rgba(255, 255, 255, 0.12) 60.19%, rgba(255, 255, 255, 0.00) 86.06%)",
        }}
      />
      <div
        className="overlay mask-border opacity-12 p-1"
        style={{ background: "linear-gradient(180deg, transparent 0%, #fff 55%, transparent 80%, #fff 95%)" }}
      />
    </div>
  );
}

/** The glassy pill button used across the site. */
export function Button({ size = "medium", variant = "primary", className, children, ...rest }: Props) {
  return (
    <motion.button
      {...rest}
      className={cn(
        className,
        "rounded-full relative group text-center block button transition-[scale] active:duration-[50ms] active:[scale:0.99] duration-[200ms] backdrop-blur-[6px]",
        `button-${variant}`,
        {
          "text-neutral-loud": variant === "secondary",
          "text-white/90": variant === "primary",
          "text-body-x-small py-10 px-20": size === "medium",
          "text-body-small py-12 px-24": size === "large",
          "text-body-x-large py-16 px-32": size === "xlarge",
        },
      )}
    >
      {variant === "primary" ? <PrimaryBackground /> : <SecondaryBackground />}
      <div className="relative">{children}</div>
    </motion.button>
  );
}
