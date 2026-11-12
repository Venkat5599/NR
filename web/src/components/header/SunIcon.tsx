"use client";

import { motion } from "motion/react";

const SPRING = { type: "spring", stiffness: 200, damping: 20 } as const;

/** Ray length and opacity for ray `index` at a theme progress: sun rays grow by midday, fade by night. */
function rayAt(progress: number, index: number): { length: number; opacity: number } {
  const long = index % 2 === 0;
  if (progress <= 1 / 3) return { length: 1.5 + 3 * progress * 1.5, opacity: long ? 0.48 + 3 * progress * 0.32 : 0.48 };
  if (progress <= 2 / 3) {
    const step = progress - 1 / 3;
    return { length: 3 - step * 4.5, opacity: long ? 0.8 - step * 0.96 : 0.48 + step * 0.96 };
  }
  const step = progress - 2 / 3;
  return { length: 1.5 + 0.8 * Math.sin(step * 3 * Math.PI), opacity: long ? 0.48 - step * 0.96 : 0.8 - step * 3 * 0.8 };
}

/** A sun that turns into a crescent as the time of day moves toward night. */
export function SunIcon({ themeProgress }: { themeProgress: number }) {
  return (
    <div className="size-24 relative">
      {Array.from({ length: 8 }, (_, index) => {
        const ray = rayAt(themeProgress, index);
        return (
          <div className="overlay" key={index} style={{ rotate: `${45 * index}deg` }}>
            <motion.div
              animate={{ height: ray.length, transform: `translateY(${((ray.length - 1.5) / 1.5) * 0.5}%)`, opacity: ray.opacity }}
              className="cw-[1.5px] bottom-19 absolute bg-white rounded-full"
              transition={SPRING}
            />
          </div>
        );
      })}
      <div className="cw-8 ch-8 absolute before:inside-border before:border-white rounded-full overflow-hidden">
        <motion.div
          animate={{ x: -16 * Math.max(0, themeProgress - 0.5) }}
          className="absolute top-0 left-0 w-full h-full bg-white transition"
          transition={SPRING}
        />
      </div>
    </div>
  );
}
