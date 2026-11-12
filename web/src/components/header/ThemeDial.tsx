"use client";

import { motion } from "motion/react";
import { useRef } from "react";
import { SunIcon } from "./SunIcon";
import { ThemedButtonOverlay } from "./ThemedButtonOverlay";
import { useThemeDrag } from "./use-theme-drag";

const TICKS = 13;

/** A draggable time-of-day dial: the sky, moon and title follow the chosen time. */
export function ThemeDial() {
  const track = useRef<HTMLDivElement>(null);
  const { themeProgress, isDragging, dragPower, handleMouseDown, handleTouchStart } = useThemeDrag(track);
  const width = isDragging ? 177 : 108;
  const fillWidth = width - 6 - 22;
  const pushingEnd = Math.abs(dragPower) > 0.1 && ((themeProgress <= 0 && dragPower < 0) || (themeProgress >= 1 && dragPower > 0));
  const stretching = isDragging && pushingEnd;
  const distances = Array.from({ length: TICKS }, (_, index) => Math.abs(themeProgress - index / (TICKS - 1)));
  const closest = Math.min(...distances);

  return (
    <motion.div
      animate={{
        width,
        paddingRight: isDragging ? 24 : 17,
        x: stretching ? 6 * dragPower : 0,
        scaleY: stretching ? Math.max(0.95, 1 - 0.05 * Math.abs(dragPower)) : 1,
        scaleX: stretching ? Math.min(1.05, 1 + 0.05 * Math.abs(dragPower)) : 1,
      }}
      className="flex items-center relative rounded-full pl-12 xl:pl-8 group h-48 xl:h-40"
      initial={{ paddingRight: 17 }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      ref={track}
      style={{ cursor: "ew-resize" }}
    >
      <ThemedButtonOverlay />
      <motion.div
        animate={{ opacity: isDragging ? 1 : 0, width: 42 + themeProgress * (fillWidth - 42) }}
        className="absolute inset-y-3 left-3 pointer-events-none rounded-l-17 rounded-r-4 max-w-[calc(100%-6px)]"
        initial={{ opacity: 0 }}
        style={{ background: "rgba(255, 255, 255, 0.06)" }}
        transition={{ duration: 0.1 }}
      >
        <motion.div
          animate={{ opacity: themeProgress }}
          className="overlay"
          style={{ background: "linear-gradient(270deg, rgba(255, 255, 255, 0.24) 0%, rgba(123, 134, 193, 0.00) 100%)" }}
        />
      </motion.div>
      <SunIcon themeProgress={themeProgress} />
      <motion.div
        animate={{ marginLeft: isDragging ? 12 : 10 }}
        className="h-20 isolate overflow-hidden pointer-events-none flex-1 flex items-center justify-between"
        initial={{ marginLeft: 10 }}
      >
        {distances.map((distance, index) => {
          const current = distance === closest;
          const major = index % 4 === 0;
          return (
            <motion.div
              animate={
                major
                  ? { height: isDragging ? (current ? 20 : 16) : current ? 16 : 8, opacity: current ? 1 : 0.48, width: isDragging && current ? 2 : 1 }
                  : { height: current ? 6 : 4, opacity: current ? 0.8 : 0.16, width: 1 }
              }
              className="bg-white rounded-full"
              key={index}
            />
          );
        })}
      </motion.div>
    </motion.div>
  );
}
