import { BlurFilter, Container, Sprite } from "pixi.js";
import { cachedTexture } from "@/components/pixi/load";
import { delay, waitUntilReady, yieldToMain, type SceneSetup } from "@/components/pixi/scene";
import { ease } from "@/lib/cubic-bezier";
import { createThemedLayers } from "@/lib/theme-store";
import { THEMES } from "@/lib/theme-layers";
import { FLOATING_FPS, TITLE_LINES, titleUrl } from "../constants";

const LINE_STAGGER_MS = 150;
const LINE_REVEAL_MS = 1200;

/** The four lines of the hero title, one image set per theme, rising out of a blur in turn. */
export const setupTitle: SceneSetup = async ({ app, canvas, add, remove, onDispose }) => {
  const root = new Container();
  root.zIndex = 6;
  root.pivot.set(756, 175);
  root.x = canvas.clientWidth / 2;
  root.y = 630;
  app.stage.addChild(root);

  const lines = TITLE_LINES.map(() => {
    const container = new Container();
    container.y = 16;
    container.x = 0;
    container.alpha = 0;
    const blur = new BlurFilter({ strength: 8 });
    container.filters = [blur];
    root.addChild(container);
    return { container, blur, completed: false };
  });

  const spritesByTheme = THEMES.map((theme) =>
    lines.map((line, index) => {
      const sprite = new Sprite(cachedTexture(titleUrl(theme, index + 1)));
      sprite.width = 1512;
      sprite.height = 436;
      sprite.alpha = 0;
      sprite.visible = false;
      line.container.addChild(sprite);
      return sprite;
    }),
  );

  onDispose(
    createThemedLayers({
      overlay: false,
      onStyleChange(index, style) {
        spritesByTheme[index]?.forEach((sprite) => {
          sprite.alpha = style.alpha;
          sprite.visible = style.alpha > 0;
        });
        root.updateCacheTexture();
      },
    }),
  );

  const showLines = (width: number) => {
    lines.forEach((line, index) => {
      line.container.visible = width >= 650 || index < 2;
    });
  };

  app.renderer.on("resize", () => {
    const width = canvas.clientWidth;
    root.pivot.set(756, 175);
    root.x = width / 2;
    if (width <= 1200 && width >= 650) root.scale.set(1 - (0.5 * (1200 - width)) / 550);
    else if (width < 650) {
      root.scale.set(width < 500 ? 0.8 : 0.9);
      root.pivot.set(385, 175);
    } else root.scale.set(1);
    root.y = 630 + (window.innerWidth < 768 ? -100 : 0);
    showLines(width);
    root.updateCacheTexture();
  });
  showLines(canvas.clientWidth);

  await waitUntilReady(canvas);
  await yieldToMain();
  await delay(1000);

  let startedAt = -1;
  const reveal = () => {
    if (startedAt === -1) startedAt = Date.now();
    const now = Date.now();
    let done = true;
    lines.forEach((line, index) => {
      if (line.completed) return;
      const elapsed = now - (startedAt + LINE_STAGGER_MS * index);
      if (elapsed < 0) {
        done = false;
        return;
      }
      if (elapsed >= LINE_REVEAL_MS) {
        line.container.alpha = 1;
        line.container.y = 0;
        line.blur.destroy();
        line.container.filters = [];
        line.completed = true;
        return;
      }
      done = false;
      const progress = ease(elapsed / LINE_REVEAL_MS);
      line.container.alpha = progress;
      line.container.y = 16 * (1 - progress);
      line.blur.strength = 8 * (1 - progress);
    });
    if (!done) return;
    app.ticker.maxFPS = FLOATING_FPS;
    remove(reveal);
    root.cacheAsTexture(true);
  };
  add(reveal);
};
