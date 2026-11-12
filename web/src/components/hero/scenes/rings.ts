import { Container, Sprite } from "pixi.js";
import { ease } from "@/lib/cubic-bezier";
import { loadTextures } from "@/components/pixi/load";
import { delay, waitUntilReady, yieldToMain, type SceneSetup } from "@/components/pixi/scene";
import { HERO_CENTER_Y, RING_URLS } from "../constants";

const RING_STAGGER_MS = 200;
const RING_REVEAL_MS = 1200;

/** Concentric rings around the moon, fading in from the outside. */
export const setupRings: SceneSetup = async ({ app, canvas, add, remove }) => {
  const group = new Container();
  group.zIndex = 100;
  const textures = await loadTextures(RING_URLS);
  app.stage.addChild(group);
  const rings = textures.map((texture) => {
    const sprite = new Sprite(texture);
    sprite.width = texture.width / 2;
    sprite.height = texture.height / 2;
    sprite.anchor.set(0.5, 0.5);
    sprite.x = canvas.clientWidth / 2;
    sprite.y = HERO_CENTER_Y;
    sprite.scale.set(0.9);
    sprite.alpha = 0;
    group.addChild(sprite);
    return { sprite, completed: false };
  });
  app.renderer.on("resize", () => {
    rings.forEach((ring) => {
      ring.sprite.x = canvas.clientWidth / 2;
    });
    group.updateCacheTexture();
  });

  await waitUntilReady(canvas);
  await yieldToMain();
  await delay(1000);

  const startedAt = Date.now();
  const reveal = () => {
    const now = Date.now();
    let done = true;
    rings.forEach((ring, index) => {
      if (ring.completed) return;
      const elapsed = now - (startedAt + RING_STAGGER_MS * index);
      if (elapsed < 0) {
        done = false;
        return;
      }
      if (elapsed >= RING_REVEAL_MS) {
        ring.sprite.alpha = 1;
        ring.sprite.scale.set(0.5);
        ring.completed = true;
        return;
      }
      done = false;
      const progress = ease(elapsed / RING_REVEAL_MS);
      ring.sprite.alpha = progress;
      ring.sprite.scale.set(0.5 * (0.9 + 0.1 * progress));
    });
    if (!done) return;
    remove(reveal);
    group.cacheAsTexture(true);
  };
  add(reveal);
};
