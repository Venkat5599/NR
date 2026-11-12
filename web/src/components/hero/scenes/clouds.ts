import { BlurFilter, Sprite, type Texture } from "pixi.js";
import { at } from "@/lib/at";
import { ease } from "@/lib/cubic-bezier";
import { loadTextures } from "@/components/pixi/load";
import { delay, waitUntilReady, yieldToMain, type SceneSetup } from "@/components/pixi/scene";
import { CLOUD_URLS, heroScale } from "../constants";
import { revealIntroDither } from "../reveal";

type RevealFrom = "left" | "right" | "top";

type CloudSpec = { texture: Texture; x: number; y: number; revealFrom: RevealFrom; initialOffset: number; zIndex: number };

type Cloud = {
  sprite: Sprite;
  targetX: number;
  targetY: number;
  blur: BlurFilter;
  completed: boolean;
  revealFrom: RevealFrom;
  initialOffset: number;
  floatPhase: number;
  floatStartTime: number;
  revealMs: number;
  floatAmplitude: number;
  floatPeriod: number;
  initialFloatOffset: number;
};

const CLOUD_STAGGER_MS = 150;

const randomSide = (): RevealFrom => (Math.random() < 0.5 ? "left" : "right");

function cloudSpecs(textures: readonly Texture[], width: number): CloudSpec[] {
  const first = at(textures, 0);
  const second = at(textures, 1);
  const third = at(textures, 2);
  const fourth = at(textures, 3);
  return [
    { texture: first, y: 109 + first.height / 2, x: width / 2 - 513 + first.width / 2, revealFrom: randomSide(), initialOffset: 10 + 20 * Math.random(), zIndex: 4 },
    { texture: second, y: 61 + second.height / 2, x: width / 2 - 1688 + second.width / 2, revealFrom: randomSide(), initialOffset: 10 + 20 * Math.random(), zIndex: 7 },
    { texture: third, y: 345 + third.height / 2, x: width / 2 - 12 + third.width / 2, revealFrom: randomSide(), initialOffset: 10 + 20 * Math.random(), zIndex: 7 },
    { texture: fourth, y: 753 + fourth.height / 2, x: width / 2, revealFrom: "top", initialOffset: 16, zIndex: 6 },
  ];
}

function narrowScreenLift(index: number, width: number): number {
  if (index === 0) return -((1 - heroScale(width)) * 140);
  if (index < 3) return 0;
  return -((1 - heroScale(width)) * 450);
}

function revealPosition(cloud: Cloud, progress: number): { x: number; y: number } {
  const x = cloud.targetX + cloud.initialFloatOffset;
  if (cloud.revealFrom === "left") return { x: x - cloud.initialOffset * (1 - progress), y: cloud.targetY };
  if (cloud.revealFrom === "right") return { x: x + cloud.initialOffset * (1 - progress), y: cloud.targetY };
  return { x, y: cloud.targetY - cloud.initialOffset * (1 - progress) };
}

/** Four cloud banks that slide in from a blur, then sway; the last one to settle reveals the intro logo. */
export const setupClouds: SceneSetup = async ({ app, canvas, add }) => {
  const textures = await loadTextures(CLOUD_URLS);
  const clouds: Cloud[] = cloudSpecs(textures, canvas.clientWidth).map((spec) => {
    const sprite = new Sprite(spec.texture);
    sprite.anchor.set(0.5);
    sprite.y = spec.y;
    const floatPhase = Math.random() * Math.PI * 2;
    const floatAmplitude = 10 + 12 * Math.random();
    const initialFloatOffset = Math.sin(floatPhase) * floatAmplitude;
    const startX = spec.x + initialFloatOffset;
    if (spec.revealFrom === "left") sprite.x = startX - spec.initialOffset;
    else if (spec.revealFrom === "right") sprite.x = startX + spec.initialOffset;
    else {
      sprite.x = startX;
      sprite.y = spec.y - spec.initialOffset;
    }
    sprite.zIndex = spec.zIndex;
    sprite.alpha = 0;
    const blur = new BlurFilter({ strength: 8 });
    sprite.filters = [blur];
    app.stage.addChild(sprite);
    return {
      sprite,
      targetX: spec.x,
      targetY: spec.y,
      blur,
      completed: false,
      revealFrom: spec.revealFrom,
      initialOffset: spec.initialOffset,
      floatPhase,
      floatStartTime: 0,
      revealMs: 1000 + 400 * Math.random(),
      floatAmplitude,
      floatPeriod: 20000 + 10000 * Math.random(),
      initialFloatOffset,
    };
  });

  let startedAt = -1;
  let introRevealed = false;

  app.renderer.on("resize", () => {
    const width = canvas.clientWidth;
    const specs = cloudSpecs(textures, width);
    clouds.forEach((cloud, index) => {
      const spec = at(specs, index);
      cloud.targetX = spec.x;
      cloud.targetY = spec.y + narrowScreenLift(index, width);
      if (index === 0) cloud.sprite.scale.set(0.6 + 0.4 * heroScale(width));
      if (cloud.completed) {
        const turn = ((Date.now() - cloud.floatStartTime) % cloud.floatPeriod) / cloud.floatPeriod;
        cloud.sprite.x = spec.x + Math.sin(cloud.floatPhase + turn * Math.PI * 2) * cloud.floatAmplitude;
        return;
      }
      const progress = ease(Math.min((Date.now() - (startedAt + CLOUD_STAGGER_MS * index)) / cloud.revealMs, 1));
      if (cloud.revealFrom === "left") cloud.sprite.x = spec.x + cloud.initialFloatOffset - cloud.initialOffset * (1 - progress);
      else if (cloud.revealFrom === "right") cloud.sprite.x = spec.x + cloud.initialFloatOffset + cloud.initialOffset * (1 - progress);
      else cloud.sprite.x = spec.x;
    });
  });

  await waitUntilReady(canvas);
  await yieldToMain();
  await delay(500);

  add(() => {
    if (startedAt === -1) startedAt = Date.now();
    const now = Date.now();
    clouds.forEach((cloud, index) => {
      const { sprite } = cloud;
      if (!cloud.completed) {
        const elapsed = now - (startedAt + CLOUD_STAGGER_MS * index);
        if (elapsed < 0) return;
        if (elapsed >= cloud.revealMs) {
          sprite.alpha = 1;
          sprite.x = cloud.targetX + cloud.initialFloatOffset;
          sprite.y = cloud.targetY;
          sprite.filters = [];
          cloud.completed = true;
          cloud.floatStartTime = now;
          return;
        }
        const progress = ease(elapsed / cloud.revealMs);
        const position = revealPosition(cloud, progress);
        sprite.alpha = progress;
        sprite.x = position.x;
        sprite.y = position.y;
        cloud.blur.strength = 8 * (1 - progress);
      }
      if (cloud.completed) {
        const turn = ((now - cloud.floatStartTime) % cloud.floatPeriod) / cloud.floatPeriod;
        sprite.x = cloud.targetX + Math.sin(cloud.floatPhase + turn * Math.PI * 2) * cloud.floatAmplitude;
      }
    });
    if (!introRevealed && clouds.every((cloud) => cloud.completed)) {
      introRevealed = true;
      revealIntroDither();
    }
  });
};
