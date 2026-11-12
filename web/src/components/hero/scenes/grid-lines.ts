import { Container, Graphics, Sprite } from "pixi.js";
import { ease } from "@/lib/cubic-bezier";
import { loadTexture } from "@/components/pixi/load";
import { delay, waitUntilReady, type SceneSetup } from "@/components/pixi/scene";
import { HERO_HEIGHT, LINES_URL } from "../constants";

const DESKTOP_WIDTH = 1024;
const START_HEIGHT = 600;
const WIPE_MS = 3000;

/** The wide line drawing behind the hero, wiped in from the bottom on desktop screens. */
export const setupGridLines: SceneSetup = async ({ app, canvas, add, remove }) => {
  if (window.innerWidth < DESKTOP_WIDTH) return;
  const group = new Container();
  group.zIndex = 100;
  const texture = await loadTexture(LINES_URL);
  const drawing = new Sprite(texture);
  drawing.width = 1920;
  drawing.height = HERO_HEIGHT;
  drawing.x = canvas.clientWidth / 2 - drawing.width / 2;
  drawing.y = -24;
  group.addChild(drawing);
  const mask = new Graphics();
  mask.rect(0, 0, canvas.clientWidth, 0).fill(0xffffff);
  group.mask = mask;
  group.addChild(mask);
  app.stage.addChild(group);
  app.renderer.on("resize", () => {
    drawing.x = canvas.clientWidth / 2 - drawing.width / 2;
    group.visible = window.innerWidth >= DESKTOP_WIDTH;
    group.updateCacheTexture();
  });

  await waitUntilReady(canvas);
  await delay(1000);

  let shown = START_HEIGHT;
  const fullHeight = canvas.clientHeight;
  const startedAt = Date.now();
  const wipe = () => {
    if (shown >= fullHeight) {
      remove(wipe);
      group.cacheAsTexture(true);
      return;
    }
    shown = START_HEIGHT + (fullHeight - START_HEIGHT) * ease(Math.min((Date.now() - startedAt) / WIPE_MS, 1));
    mask.clear();
    mask.rect(0, canvas.clientHeight - shown, canvas.clientWidth, shown).fill(0xffffff);
  };
  add(wipe);
};
