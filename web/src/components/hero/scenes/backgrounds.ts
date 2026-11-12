import { TilingSprite } from "pixi.js";
import { cachedTexture } from "@/components/pixi/load";
import type { SceneSetup } from "@/components/pixi/scene";
import { createThemedContainers } from "@/components/pixi/themed-containers";
import { onThemeTransitionEnd, onThemeTransitionStart } from "@/lib/theme-store";
import { THEMES, TRANSITION_MS_PER_UNIT } from "@/lib/theme-layers";
import { FLOATING_FPS, HERO_HEIGHT, THEME_TRANSITION_FPS, backgroundUrl } from "../constants";

/** The sky gradient, one tiled layer per time of day, cached while the theme is still. */
export const setupBackgrounds: SceneSetup = ({ app, canvas, onDispose }) => {
  const layers = THEMES.map((theme) => {
    const layer = new TilingSprite({
      texture: cachedTexture(backgroundUrl(theme)),
      width: canvas.clientWidth,
      height: HERO_HEIGHT,
      tileScale: { x: 0.5, y: 0.5 },
    });
    app.stage.addChild(layer);
    return layer;
  });
  app.renderer.on("resize", () => {
    layers.forEach((layer) => {
      layer.width = canvas.clientWidth;
    });
  });
  onDispose(createThemedContainers(layers));

  let settleTimer = 0;
  onDispose(
    onThemeTransitionStart(() => {
      if (app.ticker.maxFPS === THEME_TRANSITION_FPS) return;
      app.ticker.maxFPS = THEME_TRANSITION_FPS;
      layers.forEach((layer) => {
        if (layer.visible) layer.cacheAsTexture(false);
      });
      clearTimeout(settleTimer);
    }),
  );
  onDispose(
    onThemeTransitionEnd(() => {
      if (app.ticker.maxFPS === FLOATING_FPS) return;
      clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        app.ticker.maxFPS = FLOATING_FPS;
        layers.forEach((layer) => layer.cacheAsTexture(true));
      }, TRANSITION_MS_PER_UNIT);
    }),
  );
  onDispose(() => clearTimeout(settleTimer));
};
