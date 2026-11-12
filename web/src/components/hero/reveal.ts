export const DITHER_REVEALED_EVENT = "dither-revealed";

/** Shows the dithered intro logo once the hero clouds have settled. */
export function revealIntroDither(): void {
  const dither = document.querySelector(".intro-dither");
  if (!dither) return;
  dither.classList.remove("opacity-0", "translate-y-16", "blur-[4px]");
  dither.dispatchEvent(new Event(DITHER_REVEALED_EVENT));
}

/** Fades in the side captions a few seconds after the hero canvas appears. */
export function revealHeroCoordinates(): void {
  window.setTimeout(() => {
    document.querySelector(".hero-coordinates")?.classList.remove("hero-coordinates-not-ready");
  }, 3000);
}
