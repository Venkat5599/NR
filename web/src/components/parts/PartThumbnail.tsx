"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { MOON_MARK_PATH } from "@/components/ui/MoonMark";

function imageLoaded(image: HTMLImageElement): Promise<void> {
  if (image.complete) return Promise.resolve();
  return new Promise((resolve) => {
    image.addEventListener("load", () => resolve(), { once: true });
    image.addEventListener("error", () => resolve(), { once: true });
  });
}

/** A part's thumbnail: a pulsing crescent until the image has loaded and scrolled into view. */
export function PartThumbnail({ id }: { id: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    let observer: IntersectionObserver | null = null;
    let cancelled = false;
    void Promise.all([...element.querySelectorAll("img")].map(imageLoaded)).then(() => {
      if (cancelled) return;
      observer = new IntersectionObserver((entries) => {
        if (!entries[0]?.isIntersecting) return;
        setShown(true);
        observer?.disconnect();
      });
      observer.observe(element);
    });
    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, []);

  return (
    <>
      {!shown && (
        <div className="overlay flex-center">
          <motion.svg
            animate={{ opacity: [1, 0.5, 1] }}
            fill="none"
            height="32"
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear", repeatType: "loop" }}
            viewBox="0 0 32 32"
            width="32"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d={MOON_MARK_PATH} fill="black" fillOpacity="0.32" />
          </motion.svg>
        </div>
      )}
      <motion.div
        animate={shown ? { opacity: 1, y: 0, filter: "blur(0px)" } : { opacity: 0, y: 0, filter: "blur(4px)" }}
        initial={{ opacity: 0, y: 0, filter: "blur(4px)" }}
        ref={ref}
        transition={{ delay: 0.05 }}
      >
        <div className="w-full h-full object-cover">
          <img alt="" className="w-full h-full" draggable={false} src={`/assets/parts/${id}/thumbnail.webp`} />
        </div>
      </motion.div>
    </>
  );
}
