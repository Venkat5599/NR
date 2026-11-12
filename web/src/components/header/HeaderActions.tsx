"use client";

import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/cn";
import { useMediaQuery } from "@/lib/use-media-query";
import { FadeInItem } from "./FadeInItem";
import { useHeaderState } from "./header-state";
import { DownloadLink } from "./DownloadLink";
import { NavLinks } from "./NavLinks";
import { ThemeDial } from "./ThemeDial";

const DIAL_ENTRANCE = {
  animate: { opacity: 1, x: 0, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, x: 32, y: -16, filter: "blur(4px)" },
  initial: { opacity: 0, x: -4, y: -16, filter: "blur(4px)" },
  transition: { type: "spring", stiffness: 120, damping: 20, delay: 0.1, filter: { ease: "easeInOut", duration: 0.2 } },
} as const;

/** Top-right: the time-of-day dial over the hero, section links once scrolled, and "Download APK". */
export function HeaderActions() {
  const { isReady, isHome, isScrolled } = useHeaderState();
  const condensed = isScrolled || !isHome;
  const roomForDial = useMediaQuery("(min-width: 600px)");
  const roomForDot = useMediaQuery("(min-width: 400px)");
  const hideDotOnSmall = { "sm-max:hidden": condensed };

  return (
    <div
      className={cn(
        "flex justify-end items-center transition-all right-0 top-0 z-[101]",
        condensed ? "gap-16" : "gap-16 xl:gap-24",
        isHome && !isScrolled ? "px-32 xl:px-88 h-112 xl:h-164 absolute" : "px-24 xl:px-40 sm-max:flex-row-reverse h-88 xl:h-120 fixed",
      )}
      key={isHome ? `home-${isScrolled}` : "not-home"}
    >
      <div className="flex justify-end">
        <AnimatePresence mode="popLayout">
          <motion.div key={condensed ? "actions" : "not-actions"}>
            {condensed ? (
              <NavLinks />
            ) : (
              <div className="flex gap-12">
                {roomForDial && (
                  <motion.div {...DIAL_ENTRANCE}>
                    <FadeInItem delay={0.25}>
                      <ThemeDial />
                    </FadeInItem>
                  </motion.div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      {isReady && roomForDot ? (
        <FadeInItem
          className={cn("size-2 rounded-full transition-colors", condensed ? "bg-black/22" : "bg-white-16", hideDotOnSmall)}
          delay={0.15}
        />
      ) : (
        <div className={cn("size-2", hideDotOnSmall)} />
      )}
      <DownloadLink />
    </div>
  );
}
