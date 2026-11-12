"use client";

import { AnimatePresence, motion } from "motion/react";
import dynamic from "next/dynamic";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { QUOTES, type Quote } from "@/lib/content";
import { cn } from "@/lib/cn";
import { nextQuote, quoteWords } from "@/lib/quotes";
import { useMediaQuery } from "@/lib/use-media-query";
import { at } from "@/lib/at";

const ROTATE_MS = 5000;

/** Runs `callback` now and every `interval` ms while at least half of `element` is on screen. */
function useWhileVisible(ref: React.RefObject<HTMLElement | null>, callback: () => void, interval: number) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    let timer: number | null = null;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (timer === null) {
              callback();
              timer = window.setInterval(callback, interval);
            }
          } else if (timer !== null) {
            clearInterval(timer);
            timer = null;
          }
        });
      },
      { threshold: 0.5 },
    );
    observer.observe(element);
    return () => {
      if (timer !== null) clearInterval(timer);
      observer.disconnect();
    };
  }, [ref, callback, interval]);
}

function QuoteRotator() {
  const ref = useRef<HTMLDivElement>(null);
  const [quote, setQuote] = useState<Quote>(() => at(QUOTES, Math.floor(Math.random() * QUOTES.length)));
  const advance = useCallback(() => setQuote((current) => nextQuote(QUOTES, current)), []);
  const compact = useMediaQuery("(max-width: 768px)");
  useWhileVisible(ref, advance, ROTATE_MS);

  const blur = (amount: number) => (compact ? "unset" : `blur(${amount}px)`);
  const middle = quote.text.length / 2;

  return (
    <div
      className="h-64 lg:h-40 font-serif text-[24px]/[32px] lg:text-[32px]/[40px] lg-max:mx-auto lg-max:max-w-360 text-center mt-32 mb-40 lg:my-64 text-neutral-muted guarantee-quote"
      ref={ref}
    >
      <AnimatePresence mode="popLayout">
        <motion.div className="flex justify-center flex-wrap" key={quote.text}>
          {quoteWords(quote).map((word, wordIndex) => (
            <Fragment key={wordIndex}>
              {wordIndex !== 0 && <div className="w-6" />}
              <div className="flex">
                {word.letters.map((letter) => (
                  <motion.div
                    animate={{ opacity: 1, y: 0, filter: blur(0) }}
                    className={cn({ "text-neutral-loud": letter.highlighted })}
                    exit={{ opacity: 0, y: 12, filter: blur(4) }}
                    initial={{ opacity: 0, y: 12, filter: blur(4) }}
                    key={letter.position}
                    transition={{
                      delay: 0.025 * Math.abs(letter.position - middle),
                      type: "spring",
                      stiffness: 100,
                      damping: 20,
                      filter: { ease: "easeInOut", duration: 0.6 },
                    }}
                  >
                    {letter.char}
                  </motion.div>
                ))}
              </div>
            </Fragment>
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** A guarantee quote that rotates every few seconds, letters blurring in from the middle out. */
export const RotatingQuote = dynamic(() => Promise.resolve(QuoteRotator), {
  ssr: false,
  loading: () => <div className="h-40 my-64" />,
});
