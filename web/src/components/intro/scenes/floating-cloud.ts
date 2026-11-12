import { Sprite } from "pixi.js";
import { floatOffset, type Float } from "@/components/pixi/float";
import { loadTexture } from "@/components/pixi/load";
import type { SceneSetup } from "@/components/pixi/scene";

/** One translucent cloud drifting slowly across the intro copy. */
export const setupFloatingCloud: SceneSetup = async ({ app, canvas, add }) => {
  const texture = await loadTexture("/assets/hero/clouds-3.avif");
  const targetX = canvas.clientWidth / 2 - 398;
  const cloud = new Sprite(texture);
  const float: Float = { phase: Math.random() * Math.PI * 2, amplitude: 300, period: 140000, startedAt: Date.now() };
  cloud.x = targetX + float.amplitude * Math.sin(float.phase);
  cloud.y = 0;
  cloud.zIndex = 7;
  cloud.alpha = 0.72;
  app.stage.addChild(cloud);
  add(() => {
    cloud.x = targetX + floatOffset(float, Date.now());
  });
};
