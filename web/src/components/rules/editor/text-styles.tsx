import type { ReactNode } from "react";

type TextStyle = { key: string; swatch: ReactNode };

/** Swatches for the five text styles; the matching CSS lives under `[data-style-index]`. */
export const TEXT_STYLES: TextStyle[] = [
  { key: "plain", swatch: <div className="size-16 rounded-full bg-black/80 relative before:inside-border before:border-black/12" /> },
  {
    key: "pop",
    swatch: (
      <div
        className="size-16 rounded-full bg-[#39C8FF] relative before:inside-border before:border-[#0102AF] translate-y-1 -translate-x-1"
        style={{ boxShadow: "2px -2px 0px 0px #0102AF, 1.5px -1.5px 0px 0px #0102AF, 1px -1px 0px 0px #0102AF, 0.5px -0.5px 0px 0px #0102AF" }}
      />
    ),
  },
  {
    key: "sunset",
    swatch: (
      <div
        className="size-16 rounded-full relative -translate-y-1 -translate-x-1"
        style={{
          background: "linear-gradient(180deg, #FEDE01 0%, #FC5F02 100%)",
          boxShadow: "2px 2px 0px 0px #802601, 1.5px 1.5px 0px 0px #802601, 1px 1px 0px 0px #802601, 0.5px 0.5px 0px 0px #802601",
        }}
      />
    ),
  },
  {
    key: "rainbow",
    swatch: (
      <div
        className="size-16 rounded-full relative -translate-y-1 -translate-x-1 before:inside-border before:border-black/12"
        style={{
          background:
            "conic-gradient(from 90deg at 50% 50%, #332DAA, #BF1089 18.0000002682209deg, #F04441 54.00000214576721deg, #FBA119 108.00000429153442deg, #FDD72F 161.99999570846558deg, #85C522 216.00000858306885deg, #3B8956 270deg, #332DAA 323.99999141693115deg)",
        }}
      />
    ),
  },
  {
    key: "chrome",
    swatch: (
      <div
        className="size-16 rounded-full relative -translate-y-1 -translate-x-1"
        style={{
          background: "linear-gradient(180deg, #ACBFD3 36.84%, #FFFBFA 50.32%, #A2443C 68%, #A28687 100%)",
          boxShadow: "2px 2px 0px 0px #000, 1.5px 1.5px 0px 0px #000, 1px 1px 0px 0px #000, 0.5px 0.5px 0px 0px #000",
        }}
      />
    ),
  },
];
