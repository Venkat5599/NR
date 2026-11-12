import { Assets } from "pixi.js";
import { HERO_ASSET_URLS } from "./constants";

export const LOAD_PROGRESS_EVENT = "progress";

/** Loads every hero texture, reporting progress (0 to 1) as a `progress` event on the canvas. */
export async function preloadHero(canvas: HTMLCanvasElement): Promise<void> {
  await Assets.load(HERO_ASSET_URLS, (progress) => {
    canvas.dispatchEvent(new CustomEvent(LOAD_PROGRESS_EVENT, { detail: progress }));
  });
}
