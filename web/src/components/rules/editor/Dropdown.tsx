"use client";

import { AnimatePresence, motion, type HTMLMotionProps } from "motion/react";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Tooltip } from "./Tooltip";

const MENU_SHADOW =
  "0px 24px 12px -5px rgba(0, 0, 0, 0.02), 0px 12px 12px -5px rgba(0, 0, 0, 0.04), 0px 3px 3px -1.5px rgba(0, 0, 0, 0.02), 0px 2px 2px -1px rgba(0, 0, 0, 0.02), 0px 0.5px 0.5px 0px rgba(0, 0, 0, 0.04), 0px 0px 0px 0.75px rgba(0, 0, 0, 0.06)";

type LabelAnimation = Pick<HTMLMotionProps<"div">, "animate" | "exit" | "initial">;

type Props = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  label: ReactNode;
  labelKey?: string;
  tooltip: string;
  menu: ReactNode;
  menuClassName?: string;
  labelClassName?: string;
  labelAnimation?: LabelAnimation;
};

const pressTo = (element: HTMLElement | null, scale: number) => {
  element?.animate({ scale }, { duration: 100, easing: "ease-in-out", fill: "forwards" });
};

/** A toolbar button showing the current choice, opening a menu that tips down in 3D. */
export function Dropdown({ isOpen, setIsOpen, label, labelKey, tooltip, menu, menuClassName, labelClassName, labelAnimation }: Props) {
  const [hovered, setHovered] = useState(false);
  const [width, setWidth] = useState(0);
  const labelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const labelWidth = (labelRef.current?.getBoundingClientRect().width ?? 0) + 16;
    const row = buttonRef.current?.children[1];
    if (!row) return;
    const style = window.getComputedStyle(row);
    setWidth(labelWidth + Number(style.gap) + (Number(style.paddingLeft) + Number(style.paddingRight)));
  }, [label]);

  useEffect(() => {
    const onClick = (event: globalThis.MouseEvent) => {
      if (buttonRef.current && !event.composedPath().includes(buttonRef.current)) setIsOpen(false);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [setIsOpen]);

  const toggle = (event: MouseEvent) => {
    event.stopPropagation();
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative">
      <Tooltip content={tooltip}>
        <button
          className="rounded-6 relative block"
          onClick={toggle}
          onMouseDown={() => pressTo(buttonRef.current, 0.98)}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onMouseUp={() => pressTo(buttonRef.current, 1)}
          ref={buttonRef}
        >
          <motion.div
            animate={{ opacity: hovered ? 1 : 0, scale: hovered ? 1 : 0.9, filter: hovered ? "blur(0px)" : "blur(4px)" }}
            className="overlay bg-neutral-faint-6"
          />
          <motion.span
            animate={{ width: width || "auto" }}
            className={cn("flex gap-6 items-center py-4 pl-8 pr-6 whitespace-nowrap", labelClassName)}
          >
            <div className="flex-1 min-w-0">
              <div className="relative w-max" ref={labelRef}>
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.div
                    animate={{ opacity: 1, filter: "blur(0px)", scale: 1, y: 0 }}
                    className="text-body-finder text-neutral-loud w-max"
                    exit={{ opacity: 0, filter: "blur(4px)", scale: 0.9, y: -10 }}
                    initial={{ opacity: 0, filter: "blur(4px)", scale: 0.9, y: 10 }}
                    key={labelKey}
                    {...labelAnimation}
                  >
                    {label}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
            <svg fill="none" height="16" viewBox="0 0 16 16" width="16" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M5.3335 6.66602L7.76446 9.09698C7.89464 9.22715 8.10569 9.22715 8.23587 9.09698L10.6668 6.66602"
                stroke="black"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity="0.48"
                strokeWidth="1.5"
              />
            </svg>
          </motion.span>
        </button>
      </Tooltip>
      <div className="absolute" style={{ perspective: "400px", pointerEvents: isOpen ? "auto" : "none" }}>
        <motion.div
          animate={{ opacity: isOpen ? 1 : 0, filter: isOpen ? "blur(0px)" : "blur(4px)", rotateX: isOpen ? 0 : -20, z: isOpen ? 0 : -10 }}
          className={cn("absolute top-[calc(100%+3px)] p-4 left-0 bg-white rounded-10", menuClassName)}
          initial={{ opacity: 0, filter: "blur(4px)", rotateX: -10 }}
          style={{ boxShadow: MENU_SHADOW, transformStyle: "preserve-3d", transformOrigin: "top" }}
          transition={{ type: "spring", damping: 10, stiffness: 120 }}
        >
          <div className="py-4 px-8 text-body-micro text-neutral-faint text-left">{tooltip}</div>
          {menu}
        </motion.div>
      </div>
    </div>
  );
}
