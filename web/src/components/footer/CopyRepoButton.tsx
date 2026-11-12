"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import { REPO_SLUG } from "@/lib/content";

type Status = "idle" | "copied" | "failed";

const LABELS: Record<Status, string> = { idle: REPO_SLUG, copied: "Copied", failed: "Copy failed" };
const RESET_MS = 2000;

/** The repo name as a pill; clicking copies it and briefly says so. */
export function CopyRepoButton() {
  const [status, setStatus] = useState<Status>("idle");
  const resetTimer = useRef(-1);

  const flash = (next: Status) => {
    clearTimeout(resetTimer.current);
    setStatus(next);
    resetTimer.current = window.setTimeout(() => setStatus("idle"), RESET_MS);
  };
  const copy = () => {
    navigator.clipboard.writeText(REPO_SLUG).then(
      () => flash("copied"),
      () => flash("failed"),
    );
  };

  return (
    <motion.button
      animate={{ width: status === "idle" ? 200 : 128 }}
      className="rounded-full mx-auto overflow-clip relative text-body-large mb-80 lg:mb-92 flex-center text-neutral-loud h-60 bg-neutral-faint-6 transition-[scale,background-color] hover:bg-neutral-faint-8 active:duration-200 duration-200"
      onClick={copy}
      transition={{ type: "spring", stiffness: 180, damping: 20 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.99, transition: { duration: 0.05 } }}
    >
      <AnimatePresence initial={false}>
        <motion.div
          animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
          className="text-center cw-200 ch-80 flex-center absolute"
          exit={{ opacity: 0, filter: "blur(4px)", scale: 0.7 }}
          initial={{ opacity: 0, filter: "blur(4px)", scale: 1.5 }}
          key={status}
          transition={{ type: "spring", stiffness: 180, damping: 20, filter: { ease: "easeInOut", duration: 0.2 } }}
        >
          {LABELS[status]}
        </motion.div>
      </AnimatePresence>
    </motion.button>
  );
}
