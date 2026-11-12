"use client";

import { motion } from "motion/react";
import { useState, type RefObject } from "react";
import { Dropdown } from "./Dropdown";
import { TEXT_STYLES } from "./text-styles";

/** Picks one of the decorative text styles; hovering a swatch previews it on the line. */
export function StylePicker({ target }: { target: RefObject<HTMLDivElement | null> }) {
  const [selected, setSelected] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const preview = (index: number) => {
    if (target.current) target.current.dataset.styleIndex = index.toString();
  };

  const menu = (
    <div className="relative flex gap-4 px-2">
      <motion.div
        animate={{ opacity: hovering ? 1 : 0, scale: hovering ? 1 : 0.95, x: 36 * hoveredIndex, transition: { stiffness: 400, damping: 30, type: "spring" } }}
        className="left-2 absolute top-0 size-32 bg-neutral-faint-6 rounded-6 pointer-events-none"
        initial={{ opacity: 0 }}
      />
      {TEXT_STYLES.map((style, index) => (
        <button
          className="size-32 flex-center"
          key={style.key}
          onClick={() => {
            setSelected(index);
            preview(index);
          }}
          onMouseEnter={() => {
            setHoveredIndex(index);
            setHovering(true);
            preview(index);
          }}
          onMouseLeave={() => {
            setHovering(false);
            preview(selected);
          }}
        >
          {style.swatch}
        </button>
      ))}
    </div>
  );

  return (
    <Dropdown
      isOpen={isOpen}
      label={TEXT_STYLES[selected]?.swatch}
      labelAnimation={{
        animate: { opacity: 1, filter: "blur(0px)", scale: 1, rotate: 0 },
        exit: { opacity: 0, filter: "blur(2px)", scale: 0.5, rotate: -10 },
        initial: { opacity: 0, filter: "blur(1px)", scale: 1.1, rotate: 10 },
      }}
      labelClassName="!gap-4 !p-6"
      labelKey={selected.toString()}
      menu={menu}
      setIsOpen={setIsOpen}
      tooltip="Style"
    />
  );
}
