import { BlurFilter, Container, Sprite } from "pixi.js";
import { cachedTexture } from "@/components/pixi/load";
import { delay, waitUntilReady, type SceneSetup } from "@/components/pixi/scene";
import { ease } from "@/lib/cubic-bezier";
import { createThemedLayers } from "@/lib/theme-store";
import { THEMES } from "@/lib/theme-layers";
import { heroScale, moonUrl } from "../constants";

const REVEAL_MS = 800;
const ROCK_PERIOD_MS = 8000;
const ROCK_RADIANS = (2 * Math.PI) / 180;

/** The crescent moon: rises out of a blur, then rocks gently. */
export const setupMoon: SceneSetup = async ({ app, canvas, add, remove, onDispose }) => {
  const moon = new Container();
  moon.zIndex = 3;
  moon.alpha = 0;
  const blur = new BlurFilter({ strength: 8 });
  moon.filters = [blur];
  app.stage.addChild(moon);

  const sprites = THEMES.map((theme) => {
    const sprite = new Sprite(cachedTexture(moonUrl(theme)));
    sprite.alpha = 0;
    moon.addChild(sprite);
    return sprite;
  });
  const fitSize = () => {
    const width = 380 + 336 * heroScale(canvas.clientWidth);
    const height = (width / 716) * 580;
    sprites.forEach((sprite) => {
      sprite.width = width;
      sprite.height = height;
    });
    moon.pivot.x = width / 2;
    moon.pivot.y = height / 2;
  };
  fitSize();
  onDispose(
    createThemedLayers({
      overlay: false,
      onStyleChange(index, style) {
        const sprite = sprites[index];
        if (sprite) sprite.alpha = style.alpha;
      },
    }),
  );

  let revealed = false;
  let centerX = canvas.clientWidth / 2;
  let restY = 388;
  moon.x = centerX;
  moon.y = restY;
  app.renderer.on("resize", () => {
    centerX = canvas.clientWidth / 2;
    restY = 388 - (1 - heroScale(canvas.clientWidth)) * 130;
    fitSize();
    if (revealed) moon.x = centerX;
  });

  await waitUntilReady(canvas);
  await delay(500);

  const rock = () => {
    moon.rotation = 0;
    const startedAt = Date.now();
    add(() => {
      const elapsed = Date.now() - startedAt;
      if (elapsed < 16) return;
      const swing = (Math.sin(((elapsed % ROCK_PERIOD_MS) / ROCK_PERIOD_MS) * Math.PI * 2 - Math.PI / 2) + 1) / 2;
      moon.rotation = ROCK_RADIANS * swing;
      moon.y = restY + 10 * swing;
    });
  };

  let startedAt: number | null = null;
  const reveal = () => {
    if (revealed) return;
    startedAt ??= Date.now();
    const elapsed = Date.now() - startedAt;
    if (elapsed >= REVEAL_MS) {
      moon.alpha = 1;
      moon.y = restY;
      moon.filters = [];
      blur.destroy();
      revealed = true;
      remove(reveal);
      rock();
      return;
    }
    const progress = ease(elapsed / REVEAL_MS);
    moon.alpha = progress;
    moon.y = restY + 32 * (1 - progress);
    blur.strength = 8 * (1 - progress);
  };
  add(reveal);
};
