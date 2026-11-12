import { HERO_LABELS } from "@/lib/content";

const LETTER_STAGGER_S = 0.05;

/** The two faint captions at the hero's sides, typed in letter by letter once the hero settles. */
export function HeroCoordinates() {
  let index = 0;
  return (
    <div className="cw-[1920px] lg-max:hidden px-224 flex justify-between absolute top-478 hero-coordinates hero-coordinates-not-ready text-white/24 text-[14px]/[20px]">
      {HERO_LABELS.map((label) => (
        <div key={label}>
          {label.split("").map((char) => {
            const delay = index++ * LETTER_STAGGER_S;
            const space = char === " ";
            return (
              <div
                className="inline-block [.hero-coordinates-not-ready_&]:translate-y-1 [.hero-coordinates-not-ready_&]:opacity-0 transition duration-[400ms]"
                key={delay}
                style={{ transitionDelay: `${delay}s`, width: space ? "0.25em" : "auto" }}
              >
                {space ? null : char}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
