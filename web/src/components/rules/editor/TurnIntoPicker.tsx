"use client";

import { motion } from "motion/react";
import { useState, type ReactNode, type RefObject } from "react";
import { at } from "@/lib/at";
import { Dropdown } from "./Dropdown";
import { HeadingOneIcon, HeadingTwoIcon, TextIcon } from "./icons";

type BlockType = { title: string; className: string; icon: ReactNode };

const BLOCK_TYPES: BlockType[] = [
  { title: "Heading 1", className: "text-titles-h2", icon: <HeadingOneIcon /> },
  { title: "Heading 2", className: "text-titles-h3", icon: <HeadingTwoIcon /> },
  { title: "Text", className: "text-titles-h4", icon: <TextIcon /> },
];

/** Switches the edited line between heading and text sizes. */
export function TurnIntoPicker({ target }: { target: RefObject<HTMLDivElement | null> }) {
  const [selected, setSelected] = useState<BlockType>(() => at(BLOCK_TYPES, 1));
  const [hoveredIndex, setHoveredIndex] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const menu = (
    <div className="relative">
      <motion.div
        animate={{ opacity: hovering ? 1 : 0, scale: hovering ? 1 : 0.95, y: 32 * hoveredIndex, transition: { stiffness: 200, damping: 17, type: "spring" } }}
        className="w-full left-0 absolute top-0 h-32 bg-neutral-faint-6 rounded-6 pointer-events-none"
        initial={{ opacity: 0 }}
      />
      {BLOCK_TYPES.map((type, index) => (
        <button
          className="text-body-finder text-neutral-loud text-left py-6 px-8 flex items-center gap-8 w-full"
          key={type.title}
          onClick={() => {
            target.current?.classList.remove(selected.className);
            setSelected(type);
            target.current?.classList.add(type.className);
          }}
          onMouseEnter={() => {
            setHoveredIndex(index);
            setHovering(true);
          }}
          onMouseLeave={() => setHovering(false)}
        >
          {type.icon}
          {type.title}
        </button>
      ))}
    </div>
  );

  return <Dropdown isOpen={isOpen} label={selected.title} labelKey={selected.title} menu={menu} menuClassName="w-180" setIsOpen={setIsOpen} tooltip="Turn into" />;
}
