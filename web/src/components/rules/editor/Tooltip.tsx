"use client";

import { motion } from "motion/react";
import { useState, type ReactNode } from "react";

/** A small dark label that appears above its child on hover. */
export function Tooltip({ content, children }: { content: ReactNode; children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative" onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)}>
      {children}
      <motion.div
        animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 4, scale: visible ? 1 : 0.9, transition: { delay: visible ? 1.5 : 0 } }}
        className="bottom-[calc(100%+8px)] flex justify-center whitespace-nowrap absolute left-0 w-full"
        initial={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div className="mx-auto bg-neutral-faint text-white rounded-12 backdrop-blur-4 px-8 py-4 text-body-micro w-max">{content}</div>
      </motion.div>
    </div>
  );
}
