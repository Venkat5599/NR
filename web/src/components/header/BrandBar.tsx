"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { CRESCENT_PATH } from "@/components/ui/MoonMark";
import { cn } from "@/lib/cn";
import { useMediaQuery } from "@/lib/use-media-query";
import { FadeInItem } from "./FadeInItem";
import { useHeaderState } from "./header-state";
import { LocalClock } from "./LocalClock";

const STAGGER = 0.05;

/** Top-left: name, tagline and local time over the hero; a compact crescent link once scrolled. */
export function BrandBar() {
  const { isReady, isScrolled, isHome } = useHeaderState();
  const compact = useMediaQuery("(max-width: 1200px)");
  if (compact) return null;

  const overHero = isHome && !isScrolled;
  const dot = cn(["size-2", overHero ? "bg-white-32" : "bg-white/22"]);
  let delay = 0;
  const next = () => (delay += STAGGER);

  return (
    <div
      className={cn(
        "top-0 left-0 z-[101] text-body-x-small transition-[padding,height,color] flex items-center gap-16 select-none",
        overHero ? "text-white-100 px-88 h-164 absolute" : "text-neutral-loud px-40 h-120 fixed",
        !overHero && "mix-blend-difference !text-white",
      )}
      key={isHome ? `home-${isScrolled}` : "not-home"}
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div className="contents" key={isReady ? "ready" : "not-ready"}>
          {isReady ? (
            <>
              {!overHero && (
                <div className="w-58 flex gap-16 items-center">
                  <FadeInItem delay={next()}>
                    <Link href="/">
                      <svg fill="none" height="40" viewBox="0 0 40 40" width="40" xmlns="http://www.w3.org/2000/svg">
                        <path d={CRESCENT_PATH} fill="currentColor" />
                      </svg>
                    </Link>
                  </FadeInItem>
                  <FadeInItem className={dot} delay={next()} y={4} />
                </div>
              )}
              <FadeInItem delay={next()}>Lunar</FadeInItem>
              <FadeInItem className={dot} delay={next()} y={4} />
              <FadeInItem delay={next()}>Safe AI keyboard</FadeInItem>
            </>
          ) : null}
        </motion.div>
      </AnimatePresence>
      <AnimatePresence initial={false} mode="popLayout">
        {isReady && !isScrolled && (
          <motion.div className="contents" key="ready">
            <FadeInItem className={dot} delay={next()} y={4} />
            <FadeInItem className={isHome ? "text-white-48" : "text-white/35"} delay={next()}>
              <LocalClock />
            </FadeInItem>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
