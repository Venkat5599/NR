import { Container, Graphics, Sprite } from "pixi.js";
import { DITHER_REVEALED_EVENT } from "@/components/hero/reveal";
import { loadTexture, loadTextures } from "@/components/pixi/load";
import { delay, type SceneSetup } from "@/components/pixi/scene";
import { createThemedContainers } from "@/components/pixi/themed-containers";
import { THEMES } from "@/lib/theme-layers";

const EDGE = 40;
const COAST_MS = 5000;
const LENS_WIDTH = 69;
const LENS_HEIGHT = 77;

function waitForDitherReveal(dither: Element): Promise<void> {
  if (!dither.classList.contains("opacity-0")) return Promise.resolve();
  return new Promise((resolve) => {
    dither.addEventListener(DITHER_REVEALED_EVENT, () => delay(1000).then(resolve), { once: true });
  });
}

/**
 * A small lens that follows the pointer over the intro logo and shows the dithered,
 * time-of-day version through it; on leaving, it coasts and bounces inside the logo.
 */
export const setupDitherSpotlight: SceneSetup = async ({ app, canvas, add, remove, onDispose }) => {
  const logoTextures = loadTextures(THEMES.map((theme) => `/assets/intro/logo-dithered-${theme}.avif`));
  const frameTexture = loadTexture("/assets/intro/dither-ui.avif");
  const logos = await logoTextures;
  const frame = new Sprite(await frameTexture);
  frame.width = 88;
  frame.height = 120;
  frame.zIndex = 12;
  frame.visible = false;
  app.stage.addChild(frame);

  const dither = document.querySelector<HTMLElement>(".intro-dither");
  if (!dither) return;
  await waitForDitherReveal(dither);

  const logoRect = dither.getBoundingClientRect();
  const canvasRect = canvas.getBoundingClientRect();
  const layers = new Container();
  layers.x = logoRect.x - canvasRect.x;
  layers.y = logoRect.y - canvasRect.y;
  layers.zIndex = 1001230;
  layers.visible = false;
  app.stage.addChild(layers);
  const themed = logos.map((texture) => {
    const layer = new Container();
    layer.zIndex = 1001231;
    layer.visible = false;
    const logo = new Sprite(texture);
    logo.width = logoRect.width;
    logo.height = logoRect.height;
    layer.addChild(logo);
    layers.addChild(layer);
    return layer;
  });
  onDispose(createThemedContainers(themed));

  const lens = new Graphics();
  lens.rect(0, 0, LENS_WIDTH, LENS_HEIGHT).fill(0xffffff);
  lens.visible = false;
  lens.zIndex = 11;
  app.stage.addChild(lens);

  let velocityX = 3;
  let velocityY = 3;
  let coasting = false;
  let following = false;
  let pointerX = 0;
  let pointerY = 0;
  let lastMoveAt = 0;
  let coastStartedAt = 0;
  let targetX = 0;
  let targetY = 0;

  const placeFrame = () => {
    frame.x = lens.x + lens.width / 2 - frame.width / 2;
    frame.y = lens.y + lens.height / 2 - frame.height / 2 - 11;
  };
  const insideLogo = (event: MouseEvent) => {
    const rect = dither.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    return !(x < EDGE || x > rect.width - EDGE || y < EDGE || y > rect.height - EDGE);
  };
  const show = () => {
    layers.mask = lens;
    layers.visible = true;
    themed.forEach((layer) => {
      layer.visible = true;
    });
    lens.visible = true;
    frame.visible = true;
  };

  const follow = () => {
    const dx = targetX - lens.x;
    const dy = targetY - lens.y;
    lens.x += 0.2 * dx;
    lens.y += 0.2 * dy;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
      lens.x = targetX;
      lens.y = targetY;
    }
    placeFrame();
  };
  const coast = () => {
    const elapsed = Date.now() - coastStartedAt;
    if (elapsed >= COAST_MS) {
      stopCoasting();
      return;
    }
    const decay = 1 - elapsed / COAST_MS;
    lens.x += velocityX * decay;
    lens.y += velocityY * decay;
    placeFrame();
    const rect = dither.getBoundingClientRect();
    const bounds = canvas.getBoundingClientRect();
    const left = rect.left - bounds.left + 4;
    const right = rect.right - bounds.left - lens.width - 4;
    const top = rect.top - bounds.top + 4;
    const bottom = rect.bottom - bounds.top - lens.height - 4;
    if (lens.x <= left) {
      lens.x = left;
      velocityX = Math.abs(velocityX);
    } else if (lens.x >= right) {
      lens.x = right;
      velocityX = -Math.abs(velocityX);
    }
    if (lens.y <= top) {
      lens.y = top;
      velocityY = Math.abs(velocityY);
    } else if (lens.y >= bottom) {
      lens.y = bottom;
      velocityY = -Math.abs(velocityY);
    }
  };

  const startFollowing = () => {
    if (following) return;
    following = true;
    add(follow);
  };
  const stopFollowing = () => {
    if (!following) return;
    following = false;
    remove(follow);
  };
  const startCoasting = () => {
    if (coasting) return;
    coasting = true;
    following = false;
    coastStartedAt = Date.now();
    if (Date.now() - lastMoveAt > 0) {
      const bounds = canvas.getBoundingClientRect();
      velocityX = Math.min(Math.max((pointerX - bounds.left - lens.x) / 10, -8), 8);
      velocityY = Math.min(Math.max((pointerY - bounds.top - lens.y) / 10, -8), 8);
      if (Math.abs(velocityX) < 2) velocityX = velocityX > 0 ? 2 : -2;
      if (Math.abs(velocityY) < 2) velocityY = velocityY > 0 ? 2 : -2;
    }
    add(coast);
  };
  function stopCoasting() {
    if (!coasting) return;
    coasting = false;
    remove(coast);
  }

  const onEnter = (event: MouseEvent) => {
    if (!insideLogo(event)) return;
    show();
    stopCoasting();
    const bounds = canvas.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    lens.x = x - lens.width / 2;
    lens.y = y - lens.height / 2;
    targetX = x - lens.width / 2;
    targetY = y - lens.height / 2;
    startFollowing();
  };
  const onMove = (event: MouseEvent) => {
    pointerX = event.clientX;
    pointerY = event.clientY;
    lastMoveAt = Date.now();
    const bounds = canvas.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    if (!insideLogo(event)) {
      if (lens.visible && !coasting) {
        stopFollowing();
        startCoasting();
      }
      return;
    }
    if (!lens.visible) {
      show();
      lens.x = x - lens.width / 2;
      lens.y = y - lens.height / 2;
    }
    if (coasting) {
      stopCoasting();
      startFollowing();
    }
    targetX = x - lens.width / 2;
    targetY = y - lens.height / 2;
    if (!following) startFollowing();
  };
  const onLeave = () => {
    if (lens.visible && !coasting) {
      stopFollowing();
      startCoasting();
    }
  };
  dither.addEventListener("mouseenter", onEnter);
  dither.addEventListener("mousemove", onMove);
  dither.addEventListener("mouseleave", onLeave);
  onDispose(() => {
    dither.removeEventListener("mouseenter", onEnter);
    dither.removeEventListener("mousemove", onMove);
    dither.removeEventListener("mouseleave", onLeave);
  });

  add(() => {
    app.ticker.maxFPS = app.ticker.count === 3 ? 10 : Infinity;
  });
};
