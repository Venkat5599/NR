import { Graphics, Sprite } from "pixi.js";
import { at } from "@/lib/at";
import { floatOffset, type Float } from "@/components/pixi/float";
import { loadTexture, loadTextures } from "@/components/pixi/load";
import type { SceneSetup } from "@/components/pixi/scene";

export type ApproverId = "holder" | "guardian";

/** The resting portrait, stretched to the canvas. */
export function restingPortrait(id: ApproverId): SceneSetup {
  return async ({ app, canvas }) => {
    const portrait = new Sprite(await loadTexture(`/assets/approvers/${id}-rest.avif`));
    portrait.x = 0;
    portrait.y = 0;
    portrait.width = canvas.clientWidth;
    portrait.height = canvas.clientHeight;
    app.stage.addChild(portrait);
  };
}

type Shake = { nextAt: number; count: number };

/**
 * Glitch slices of the alternate portrait: horizontal bands and vertical strips that
 * jitter now and then, and constantly while the pointer is over the canvas.
 */
export function glitchSlices(id: ApproverId): SceneSetup {
  return async ({ app, canvas, add, onDispose }) => {
    const texture = await loadTexture(`/assets/approvers/${id}-vibe.avif`);
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const slice = (mask: Graphics) => {
      const sprite = new Sprite(texture);
      sprite.x = 0;
      sprite.y = 0;
      sprite.width = width;
      sprite.height = height;
      sprite.mask = mask;
      sprite.zIndex = 1;
      return sprite;
    };
    const slices: Sprite[] = [];
    for (let top = 0; top < height; ) {
      const band = (0.1 + 0.2 * Math.random()) * height;
      slices.push(slice(new Graphics().rect(0, top, width, band).fill("#fff")));
      top += band;
    }
    for (let left = 0; left < width; ) {
      const strip = (0.01 + 0.1 * Math.random()) * width;
      const stripHeight = (0.1 + 0.3 * Math.random()) * height;
      const stripTop = Math.random() * height;
      slices.push(slice(new Graphics().rect(left, stripTop, strip, stripHeight).fill("#fff")));
      left += strip;
    }
    app.stage.addChild(...slices);

    let hovered = false;
    const shakes: Shake[] = slices.map(() => ({ nextAt: Date.now() + (3000 + 5000 * Math.random()), count: 0 }));
    const rest = (shake: Shake) => {
      shake.nextAt = hovered ? Date.now() + 200 * Math.random() : Date.now() + 4000;
    };

    add(() => {
      const now = Date.now();
      slices.forEach((sprite, index) => {
        const shake = shakes[index];
        if (!shake) return;
        if (now < shake.nextAt) {
          sprite.visible = false;
          return;
        }
        if (now - shake.nextAt <= (hovered ? 60 : 100)) return;
        shake.nextAt = Date.now();
        shake.count++;
        sprite.visible = true;
        if (!hovered && shake.count > 3 + Math.floor(6 * Math.random())) {
          shake.count = 0;
          rest(shake);
          sprite.x = 0;
          sprite.y = 0;
          sprite.visible = false;
          return;
        }
        sprite.zIndex = Math.random() > (hovered ? 0.2 : 0.7) ? 1 : -1;
        if (hovered && Math.random() > 0.2) {
          sprite.x = 0;
          sprite.y = 0;
          return;
        }
        const burst = Math.random() > 0.8 ? 1 : 0;
        sprite.x = (Math.random() - 0.5) * (hovered ? 30 + 100 * burst : 100);
        sprite.y = (Math.random() - 0.5) * (hovered ? 10 + 50 * burst : 50);
      });
    });

    const onEnter = () => {
      hovered = true;
      shakes.forEach((shake) => {
        shake.nextAt = Date.now() + 1000 * Math.random();
      });
    };
    const onLeave = () => {
      hovered = false;
      shakes.forEach((shake) => {
        shake.count = 2;
      });
    };
    canvas.addEventListener("mouseenter", onEnter);
    canvas.addEventListener("mouseleave", onLeave);
    onDispose(() => {
      canvas.removeEventListener("mouseenter", onEnter);
      canvas.removeEventListener("mouseleave", onLeave);
    });
  };
}

const CLOUD_PLACES = [
  { y: -43, x: -226, zIndex: 4 },
  { y: 270, x: -226, zIndex: 7 },
  { y: 156, x: 167, zIndex: 7 },
];

/** Three small clouds drifting in front of the portrait. */
export const driftingClouds: SceneSetup = async ({ app, add }) => {
  const textures = await loadTextures(CLOUD_PLACES.map((_, index) => `/assets/approvers/clouds-${index + 1}.avif`));
  const clouds = CLOUD_PLACES.map((place, index) => {
    const sprite = new Sprite(at(textures, index));
    sprite.y = place.y;
    sprite.x = place.x;
    sprite.zIndex = place.zIndex;
    sprite.alpha = 1;
    app.stage.addChild(sprite);
    const float: Float = {
      phase: Math.random() * Math.PI * 2,
      amplitude: 10 + 12 * Math.random(),
      period: 20000 + 20000 * Math.random(),
      startedAt: Date.now(),
    };
    return { sprite, targetX: place.x, float };
  });
  add(() => {
    const now = Date.now();
    clouds.forEach((cloud) => {
      cloud.sprite.x = cloud.targetX + floatOffset(cloud.float, now);
    });
  });
};
