import type { ReactNode } from "react";

/** The small numbered label above each section title, e.g. "02  Checks a scammer can't skip". */
export function SectionHeading({ index, children }: { index: number; children: ReactNode }) {
  return (
    <div className="text-neutral-faint text-titles-h3 relative mx-auto w-max">
      <div className="text-[12px]/[12px] font-mono size-32 flex-center absolute -top-32 -left-32 text-neutral-faint-3">
        {"0"}
        {index}
      </div>
      {children}
    </div>
  );
}

export function SectionDot() {
  return <div className="size-2 lg:size-3 bg-neutral-faint my-16 lg:my-32 mx-auto" />;
}

/** The full-bleed illustration that opens a section. */
export function SectionImage({ src }: { src: string }) {
  return (
    <div className="cw-[800px] h-[500px] object-cover mb-8 relative">
      <img alt="" className="w-full h-full" draggable={false} src={src} />
    </div>
  );
}
