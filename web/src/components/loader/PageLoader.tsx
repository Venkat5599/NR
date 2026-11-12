"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { LOAD_PROGRESS_EVENT } from "@/components/hero/preload";
import { MOON_MARK_PATH } from "@/components/ui/MoonMark";

const RING_PATH =
  "M40 0.5C45.1872 0.5 50.3236 1.5217 55.116 3.50676C59.9084 5.49182 64.2628 8.40137 67.9307 12.0693C71.5986 15.7372 74.5082 20.0916 76.4932 24.884C78.4783 29.6764 79.5 34.8128 79.5 40C79.5 45.1872 78.4783 50.3236 76.4932 55.116C74.5082 59.9084 71.5986 64.2628 67.9307 67.9307C64.2628 71.5986 59.9083 74.5082 55.116 76.4932C50.3236 78.4783 45.1872 79.5 40 79.5C34.8128 79.5 29.6764 78.4783 24.884 76.4932C20.0916 74.5082 15.7372 71.5986 12.0693 67.9307C8.40136 64.2628 5.49181 59.9083 3.50675 55.116C1.52169 50.3236 0.499997 45.1872 0.5 40C0.500003 34.8128 1.5217 29.6763 3.50677 24.884C5.49183 20.0916 8.40138 15.7372 12.0693 12.0693C15.7372 8.40135 20.0917 5.49181 24.884 3.50675C29.6764 1.52169 34.8128 0.499997 40 0.5L40 0.5Z";

const HIDE_DELAY_MS = 800;

/** A full-screen veil with a progress ring that lifts once the hero assets have loaded. */
export function PageLoader() {
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    document.body.classList.add("overflow-hidden");
    const hero = document.querySelector(".hero-pixi");
    let hideTimer = 0;
    const onProgress = (event: Event) => {
      if (!(event instanceof CustomEvent) || typeof event.detail !== "number") return;
      setProgress(event.detail);
      if (event.detail !== 1) return;
      hero?.removeEventListener(LOAD_PROGRESS_EVENT, onProgress);
      hideTimer = window.setTimeout(() => {
        setDone(true);
        document.body.classList.remove("overflow-hidden");
      }, HIDE_DELAY_MS);
    };
    hero?.addEventListener(LOAD_PROGRESS_EVENT, onProgress);
    return () => {
      hero?.removeEventListener(LOAD_PROGRESS_EVENT, onProgress);
      clearTimeout(hideTimer);
    };
  }, []);

  return (
    <AnimatePresence initial={false}>
      {!done && (
        <motion.div
          animate={{ opacity: 1 }}
          className="fixed top-0 left-0 w-screen h-full bg-white z-[10001] flex-center"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
        >
          <motion.div
            animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
            className="size-80 rounded-full flex-center before:inside-border before:border-neutral-faint-5 relative"
            exit={{ scale: 0.5, opacity: 0, filter: "blur(10px)" }}
          >
            <svg fill="none" height="32" viewBox="0 0 32 32" width="32" xmlns="http://www.w3.org/2000/svg">
              <path d={MOON_MARK_PATH} fill="#050505" fillOpacity="0.8" />
            </svg>
            <svg className="overlay" fill="none" height="80" viewBox="0 0 80 80" width="80" xmlns="http://www.w3.org/2000/svg">
              <path
                className="transition-all duration-[800ms] ease-in-out"
                d={RING_PATH}
                stroke="#050505"
                strokeDasharray="250"
                strokeDashoffset={250 * (1 - progress)}
                strokeOpacity="0.8"
              />
            </svg>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
