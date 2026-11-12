"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useHeaderState } from "./header-state";

type Props = { delay?: number; y?: number; className?: string | undefined; children?: ReactNode };

function mediaReady(element: HTMLElement): Promise<unknown> {
  const images = [...element.querySelectorAll("img")].map((image) =>
    image.complete ? Promise.resolve() : new Promise((resolve) => image.addEventListener("load", resolve, { once: true })),
  );
  return Promise.all(images);
}

/** A header item that drops in from above once the hero is ready and the item is on screen. */
export function FadeInItem({ delay = 0, y = 8, className, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { isReady } = useHeaderState();
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    let observer: IntersectionObserver | null = null;
    let active = true;
    void mediaReady(element).then(() => {
      if (!active) return;
      observer = new IntersectionObserver((entries) => {
        if (!entries[0]?.isIntersecting) return;
        setInView(true);
        observer?.disconnect();
      });
      observer.observe(element);
    });
    return () => {
      active = false;
      observer?.disconnect();
    };
  }, []);

  return (
    <motion.div
      animate={inView && isReady ? { opacity: 1, y: 0, filter: "blur(0px)" } : { opacity: 0, y: -y, filter: "blur(4px)" }}
      className={className}
      exit={{ opacity: 0, y, filter: "blur(4px)" }}
      initial={{ opacity: 0, y: -y, filter: "blur(4px)" }}
      ref={ref}
      transition={{ delay, type: "spring", stiffness: 60, damping: 10, filter: { ease: "easeInOut", duration: 0.4 } }}
    >
      {children}
    </motion.div>
  );
}
