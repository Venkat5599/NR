"use client";

import { AnimatePresence, animate, motion } from "motion/react";
import Link from "next/link";
import { useRef } from "react";
import { Button } from "@/components/ui/Button";
import { FadeInItem } from "./FadeInItem";
import { useHeaderState } from "./header-state";
import { ThemedButtonOverlay } from "./ThemedButtonOverlay";

const ENTRANCE = { delay: 0.1, type: "spring", stiffness: 60, damping: 10, filter: { ease: "easeInOut", duration: 0.4 } } as const;

/** "Join waitlist": a glass pill over the hero, a regular button once the page has scrolled. */
export function JoinWaitlistLink() {
  const { isHome, isScrolled, isReady } = useHeaderState();
  const pill = useRef<HTMLButtonElement>(null);
  const overHero = isHome && !isScrolled;
  return (
    <AnimatePresence mode="popLayout">
      <motion.div key={overHero ? "hero" : "not-hero"}>
        <Link className="contents" href="/#waitlist">
          {overHero ? (
            <FadeInItem delay={0.1}>
              <motion.button
                animate={{ opacity: 1, filter: "blur(0px)" }}
                className="py-14 xl:py-10 px-30 xl:px-20 rounded-full group text-body-x-small text-white-90 relative"
                exit={{ opacity: 0, filter: "blur(4px)" }}
                initial={{ opacity: 0, filter: "blur(4px)" }}
                onMouseDown={() => {
                  if (pill.current) animate(pill.current, { scale: 0.98 }, { visualDuration: 0.05 });
                }}
                onMouseUp={() => {
                  if (pill.current) animate(pill.current, { scale: 1 }, { duration: 0.05 });
                }}
                ref={pill}
                transition={{ type: "spring", stiffness: 120, damping: 10, filter: { ease: "easeInOut", duration: 0.2 } }}
              >
                <ThemedButtonOverlay />
                Join waitlist
              </motion.button>
            </FadeInItem>
          ) : (
            <Button
              animate={isReady ? { opacity: 1, y: 0, filter: "blur(0px)", transition: ENTRANCE } : { opacity: 0, y: -10, filter: "blur(4px)" }}
              exit={{ opacity: 0, y: 10, filter: "blur(4px)" }}
              initial={{ opacity: 0, y: -10, filter: "blur(4px)" }}
              size="medium"
              transition={ENTRANCE}
            >
              Join waitlist
            </Button>
          )}
        </Link>
      </motion.div>
    </AnimatePresence>
  );
}
