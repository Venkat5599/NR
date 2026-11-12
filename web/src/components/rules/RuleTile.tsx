"use client";

import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { RULE_DETAILS } from "@/lib/content";
import { cn } from "@/lib/cn";

const REVEAL = { duration: 0.45, ease: [0.6, 0.6, 0, 1] as const };
const HIDDEN = { y: 24, opacity: 0, filter: "blur(6px)" };
const SHOWN = { y: 0, opacity: 1, filter: "blur(0px)" };

const CARD_BACKGROUND =
  "radial-gradient(65.62% 65.62% at 50% 50%, rgba(0, 0, 0, 0.32) 0%, rgba(0, 0, 0, 0.00) 100%), linear-gradient(180deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.00) 100%), rgba(0, 0, 0, 0.56)";
const CARD_SHADOW =
  "0px -12px 16px 0px rgba(255, 255, 255, 0.06) inset, 0px 4px 16px 0px rgba(255, 255, 255, 0.16) inset, 0px 0.75px 0.25px 0px rgba(255, 255, 255, 0.12) inset, 0px 0.25px 0.25px 0px rgba(255, 255, 255, 0.32) inset, 0px 12px 16px 0px rgba(0, 0, 0, 0.06), 0px 23px 14px 0px rgba(0, 0, 0, 0.06), 0px 10px 10px 0px rgba(0, 0, 0, 0.06), 0px 3px 6px 0px rgba(0, 0, 0, 0.19), 0px 0px 0px 0.75px rgba(0, 0, 0, 0.56)";

/** True once the tile has been on screen and its top has scrolled within 100px of the viewport top. */
function useNearViewportTop(ref: React.RefObject<HTMLDivElement | null>): boolean {
  const [nearTop, setNearTop] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    let seen = false;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) seen = true;
      });
    });
    observer.observe(element);
    const onScroll = () => {
      if (seen) setNearTop(element.getBoundingClientRect().top < 100);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [ref]);
  return nearTop;
}

type Props = { id: string; mobileOnly: boolean };

/**
 * One rule tile. Tiles with details blur away on hover and show a card with the rule's
 * icon and tags, above the tile, or below it once the tile nears the top of the screen.
 */
export function RuleTile({ id, mobileOnly }: Props) {
  const details = RULE_DETAILS[id];
  const [hovered, setHovered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const cardBelow = useNearViewportTop(ref);
  const sizing = cn("aspect-[290/132] h-110 lg:h-132 w-auto", { "lg:hidden": mobileOnly });
  const src = `/assets/rules/tiles/${id}.png`;

  if (!details) return <Image alt="Rule" className={sizing} height={132} src={src} width={290} />;

  return (
    <div className={cn(sizing, "relative")}>
      <div className="w-full h-full" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} ref={ref}>
        <Image
          alt="Rule"
          className={cn("w-full h-full transition-all ease-[0.6,0.6,0,1] duration-[450ms]", {
            "opacity-0 -translate-y-24 blur-[6px]": hovered,
          })}
          height={132}
          src={src}
          width={290}
        />
        <div className="flex-center center">
          <AnimatePresence>
            {hovered && (
              <Link className="contents" href="/#rules">
                <Button animate={SHOWN} exit={HIDDEN} initial={HIDDEN} size="large" transition={REVEAL} variant="secondary">
                  See details
                </Button>
              </Link>
            )}
          </AnimatePresence>
        </div>
      </div>
      <AnimatePresence initial={false} mode="popLayout">
        {hovered && (
          <motion.div
            animate={SHOWN}
            className={cn("absolute z-[12] pointer-events-none cw-314 rounded-24 p-24 backdrop-blur-6", {
              "-top-116": !cardBelow,
              "-bottom-116": cardBelow,
            })}
            exit={HIDDEN}
            initial={HIDDEN}
            key={`${id}-card`}
            style={{ background: CARD_BACKGROUND, boxShadow: CARD_SHADOW }}
            transition={REVEAL}
          >
            <div
              className="overlay mask-border p-1 opacity-24"
              style={{ backgroundImage: "linear-gradient(to bottom, #fff 1%, #999999 55%, #fff 80%, #999999 100%)" }}
            />
            <div className="relative">
              <Image
                alt={details.title}
                className="size-28 mb-20 mx-auto"
                height={28}
                src={`/assets/parts/${id}/icon-solid-white.avif`}
                width={28}
              />
              <div className="text-body-small text-white mb-8 text-center">{details.title}</div>
              <div className="text-body-small text-white/64 flex gap-8 items-center justify-center">
                {details.tags.map((tag, index) => (
                  <Fragment key={tag}>
                    {index !== 0 && <div className="size-[1.5px] bg-white/46" />}
                    <div>{tag}</div>
                  </Fragment>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
