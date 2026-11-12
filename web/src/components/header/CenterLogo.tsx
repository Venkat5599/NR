"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { CRESCENT_PATH } from "@/components/ui/MoonMark";
import { cn } from "@/lib/cn";
import { useMediaQuery } from "@/lib/use-media-query";
import { useHeaderState } from "./header-state";
import { ThemedLogo } from "./ThemedLogo";

const RULE_TRANSITION = { delay: 1, type: "spring", stiffness: 30, damping: 10 } as const;

/** The centred moon badge flanked by short rules; on small screens it stays as a corner link. */
export function CenterLogo() {
  const { isReady, isHome, isScrolled } = useHeaderState();
  const compact = useMediaQuery("(max-width: 1200px)");
  const visible = isReady && (compact || (isHome && !isScrolled));
  const overHero = isHome && !isScrolled;
  return (
    <AnimatePresence initial={false}>
      {visible && (
        <div
          className={cn(
            "flex gap-20 items-center top-0 left-0 transition-[padding] xl:center-x z-[101] xl:h-164",
            overHero ? "xl-max:absolute xl-max:p-32" : "xl-max:fixed mix-blend-difference xl-max:p-24",
          )}
        >
          {!compact && (
            <motion.div animate={{ scaleX: 1 }} className="w-32 h-1 bg-white/8 origin-right" exit={{ scaleX: 0 }} initial={{ scaleX: 0 }} transition={RULE_TRANSITION} />
          )}
          <motion.div
            animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
            className={cn("xl:size-64 relative rounded-full", overHero ? "backdrop-blur-4 size-48" : "flex-center size-40")}
            exit={{ scale: 0.8, opacity: 0, filter: "blur(4px)" }}
            initial={{ scale: 0.8, opacity: 0, filter: "blur(4px)" }}
            transition={{ delay: 0.6, type: "spring", stiffness: 20, damping: 10, filter: { ease: "easeInOut", duration: 0.4 } }}
          >
            {overHero ? (
              <ThemedLogo />
            ) : (
              <Link href="/">
                <svg fill="none" height="40" viewBox="0 0 40 40" width="40" xmlns="http://www.w3.org/2000/svg">
                  <path d={CRESCENT_PATH} fill="white" fillOpacity="0.8" />
                </svg>
              </Link>
            )}
          </motion.div>
          {!compact && (
            <motion.div animate={{ scaleX: 1 }} className="w-32 h-1 bg-white/8 origin-left" exit={{ scaleX: 0 }} initial={{ scaleX: 0 }} transition={RULE_TRANSITION} />
          )}
        </div>
      )}
    </AnimatePresence>
  );
}
