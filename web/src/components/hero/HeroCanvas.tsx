"use client";

import { PixiCanvas } from "@/components/pixi/PixiCanvas";
import type { SceneSetup } from "@/components/pixi/scene";
import { REVEAL_FPS } from "./constants";
import { preloadHero } from "./preload";
import { revealHeroCoordinates } from "./reveal";
import { setupBackgrounds } from "./scenes/backgrounds";
import { setupClouds } from "./scenes/clouds";
import { setupGridLines } from "./scenes/grid-lines";
import { setupMoon } from "./scenes/moon";
import { setupRays } from "./scenes/rays";
import { setupRings } from "./scenes/rings";
import { setupStars } from "./scenes/stars";
import { setupTitle } from "./scenes/title";

const setupGuides: SceneSetup = async (scene) => {
  await Promise.all([setupRings(scene), setupGridLines(scene)]);
};

const HERO_SETUPS: SceneSetup[] = [setupBackgrounds, setupTitle, setupClouds, setupStars, setupMoon, setupRays, setupGuides];

export function HeroCanvas() {
  return (
    <PixiCanvas
      className="overlay hero-pixi"
      fps={REVEAL_FPS}
      onReady={revealHeroCoordinates}
      preload={preloadHero}
      setups={HERO_SETUPS}
    />
  );
}
