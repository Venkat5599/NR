import { Particle, ParticleContainer, type Texture } from "pixi.js";
import { cachedTexture } from "@/components/pixi/load";
import type { SceneSetup } from "@/components/pixi/scene";
import { DOT_GLOW_URL, DOT_SOLID_URL, DOT_URL } from "../constants";

type Star = {
  particle: Particle;
  alpha: number;
  direction: 1 | -1;
  maxAlpha: number;
  container: ParticleContainer;
  isGlow: boolean;
  baseScale: number;
};

const TWINKLE_STEP_MS = 50;

/** A field of twinkling dots: mostly soft, some solid, a few glowing ones that swell in and out. */
export const setupStars: SceneSetup = ({ app, canvas, add }) => {
  const createLayer = () => new ParticleContainer({ dynamicProperties: { position: true } });
  const regularLayer = createLayer();
  const solidLayer = createLayer();
  const glowLayer = createLayer();
  const containers = [regularLayer, solidLayer, glowLayer];
  containers.forEach((container) => app.stage.addChild(container));
  regularLayer.zIndex = 2;
  solidLayer.zIndex = 2;
  glowLayer.zIndex = 3;

  const regular = cachedTexture(DOT_URL);
  const solid = cachedTexture(DOT_SOLID_URL);
  const glow = cachedTexture(DOT_GLOW_URL);

  const createStar = (x: number, y: number): Star => {
    const roll = Math.random();
    const isGlow = roll < 0.05;
    const kind = isGlow ? "glow" : roll < 0.6 ? "solid" : "regular";
    const texture: Texture = kind === "glow" ? glow : kind === "solid" ? solid : regular;
    const container = kind === "glow" ? glowLayer : kind === "solid" ? solidLayer : regularLayer;
    const particle = new Particle({ texture, x, y });
    if (isGlow) {
      particle.anchorX = 0.5;
      particle.anchorY = 0.5;
    }
    let scale: number;
    if (kind === "regular") scale = Math.random() < 0.8 ? 0.75 : 1 + 0.5 * Math.random();
    else if (kind === "solid") scale = Math.random() < 0.8 ? 0.75 : 0.8 + 0.3 * Math.random();
    else {
      scale = 1 + 0.5 * Math.random();
      particle.scaleX = 0;
      particle.scaleY = 0;
    }
    if (!isGlow) {
      particle.scaleX = scale / 2;
      particle.scaleY = scale / 2;
    }
    particle.alpha = isGlow ? 0 : Math.random();
    container.addParticle(particle);
    return {
      particle,
      alpha: 2 * Math.random() - 1,
      direction: Math.random() > 0.5 ? 1 : -1,
      maxAlpha: 1,
      container,
      isGlow,
      baseScale: scale / 2,
    };
  };

  const randomPoint = () => ({ x: Math.random() * canvas.clientWidth, y: Math.pow(Math.random(), 1.1) * canvas.clientHeight });

  const stars: Star[] = [];
  const fill = (target: number) => {
    for (let index = stars.length; index < target; index++) {
      const { x, y } = randomPoint();
      stars.push(createStar(x, y));
    }
  };
  fill(canvas.clientWidth / 3);

  app.renderer.on("resize", () => {
    const target = canvas.clientWidth / 3;
    if (target < stars.length) {
      stars.splice(Math.trunc(target)).forEach((star) => star.container.removeParticle(star.particle));
    } else fill(target);
  });

  let lastStep = 0;
  add(() => {
    const now = performance.now();
    const elapsed = now - lastStep;
    if (elapsed < TWINKLE_STEP_MS) return;
    lastStep = now - (elapsed % TWINKLE_STEP_MS);
    stars.forEach((star) => {
      star.alpha += star.direction * (star.isGlow ? 0.08 : 0.05);
      if (star.alpha > 1) star.direction = -1;
      else if (star.alpha < -1) {
        star.direction = 1;
        star.particle.x = Math.random() * canvas.clientWidth;
        star.particle.y = Math.random() * canvas.clientHeight;
      }
      if (star.isGlow) {
        const visible = Math.max(0, star.alpha);
        star.particle.alpha = visible * star.maxAlpha;
        star.particle.scaleX = visible * star.baseScale;
        star.particle.scaleY = visible * star.baseScale;
      } else star.particle.alpha = Math.max(0, star.alpha * star.maxAlpha);
    });
    containers.forEach((container) => container.update());
  });
};
