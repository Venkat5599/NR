import type { Application, Container, Texture, TickerCallback } from "pixi.js";

export const PIXI_READY_EVENT = "pixi-initialized";

/** What each scene setup receives: the app, its canvas and ref-counted ticker helpers. */
export type PixiScene = {
  app: Application;
  canvas: HTMLCanvasElement;
  /** Adds a ticker callback; the ticker runs while at least one callback is registered. */
  add: (callback: TickerCallback<unknown>) => void;
  remove: (callback: TickerCallback<unknown>) => void;
  /** Registers cleanup to run when the canvas unmounts. */
  onDispose: (cleanup: () => void) => void;
};

export type SceneSetup = (scene: PixiScene) => void | Promise<void>;

export type PixiErrorCode = "renderer_unavailable" | "preload_failed" | "setup_failed";

export class PixiCanvasError extends Error {
  readonly code: PixiErrorCode;
  constructor(code: PixiErrorCode, message: string, options?: { cause: unknown }) {
    super(message, options);
    this.name = "PixiCanvasError";
    this.code = code;
  }
}

export function isDestroyed(app: Application): boolean {
  return !app.ticker || !app.renderer || !app.stage;
}

/** Resolves once the canvas has rendered its first frame and faded in. */
export function waitUntilReady(canvas: HTMLCanvasElement): Promise<void> {
  if (canvas.dataset.pixiReady === "true") return Promise.resolve();
  return new Promise((resolve) => {
    canvas.addEventListener(PIXI_READY_EVENT, () => resolve(), { once: true });
  });
}

/** Gives the main thread back to the browser between scene setups. */
export function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function degreesToRadians(degrees: number): number {
  return (Math.PI / 180) * degrees;
}

export function renderToTexture(app: Application, target: Container): Texture {
  return app.renderer.generateTexture(target);
}
