"use client";

import { Application, type ApplicationOptions } from "pixi.js";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import {
  PIXI_READY_EVENT,
  PixiCanvasError,
  isDestroyed,
  nextFrame,
  yieldToMain,
  type PixiScene,
  type SceneSetup,
} from "./scene";

type Props = {
  className: string;
  setups: SceneSetup[];
  preload?: (canvas: HTMLCanvasElement) => Promise<void>;
  onReady?: (canvas: HTMLCanvasElement) => void;
  /** Receives init and setup failures; without it they are rethrown. */
  onError?: (error: PixiCanvasError) => void;
  fps?: number;
  resolution?: number;
  initOptions?: Partial<ApplicationOptions>;
};

/**
 * A canvas driven by one Pixi application. Each setup builds part of the scene; the
 * ticker only runs while a setup has a callback registered and the canvas is on screen.
 */
export function PixiCanvas({
  className,
  setups,
  preload,
  onReady,
  onError,
  fps = 60,
  resolution = 1,
  initOptions,
}: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const cleanups: Array<() => void> = [];
    let disposed = false;

    const fail = (error: PixiCanvasError) => {
      canvas.dataset.pixiError = error.code;
      if (disposed) return;
      if (onError) onError(error);
      else throw error;
    };

    const start = async () => {
      canvas.style.opacity = "0";
      if (preload) {
        try {
          await preload(canvas);
        } catch (cause) {
          fail(new PixiCanvasError("preload_failed", "loading scene assets failed", { cause }));
          return;
        }
      }
      await nextFrame();
      if (disposed) return;

      const app = new Application();
      try {
        await app.init({
          canvas,
          resolution: (window.devicePixelRatio || 1) * resolution,
          width: canvas.clientWidth,
          height: canvas.clientHeight,
          antialias: false,
          hello: false,
          autoStart: true,
          sharedTicker: false,
          clearBeforeRender: true,
          ...initOptions,
        });
      } catch (cause) {
        fail(new PixiCanvasError("renderer_unavailable", "no WebGL or WebGPU renderer could start", { cause }));
        return;
      }
      cleanups.push(() => {
        if (!isDestroyed(app)) app.destroy({}, { children: true, context: true, style: true });
        canvas.style.opacity = "0";
        delete canvas.dataset.pixiReady;
      });
      if (disposed) {
        cleanups.forEach((cleanup) => cleanup());
        return;
      }

      let activeCallbacks = 0;
      if (fps !== Infinity) app.ticker.maxFPS = fps;
      const scene: PixiScene = {
        app,
        canvas,
        add: (callback) => {
          if (isDestroyed(app)) return;
          activeCallbacks += 1;
          if (activeCallbacks === 1) app.ticker.start();
          app.ticker.add(callback);
        },
        remove: (callback) => {
          if (isDestroyed(app)) return;
          activeCallbacks -= 1;
          if (activeCallbacks === 0) app.ticker.stop();
          app.ticker.remove(callback);
        },
        onDispose: (cleanup) => cleanups.push(cleanup),
      };

      for (const setup of setups) {
        await yieldToMain();
        if (disposed) return;
        Promise.resolve()
          .then(() => setup(scene))
          .catch((cause: unknown) => {
            fail(new PixiCanvasError("setup_failed", `scene setup "${setup.name}" failed`, { cause }));
          });
      }

      app.stage.eventMode = "passive";
      app.stage.cullable = true;
      app.stage.sortableChildren = false;
      app.stage.interactiveChildren = false;
      app.render();
      const revealTimer = window.setTimeout(() => {
        onReady?.(canvas);
        canvas.dataset.pixiReady = "true";
        canvas.dispatchEvent(new Event(PIXI_READY_EVENT));
        canvas.style.opacity = "1";
      }, 100);

      const visibility = new IntersectionObserver(([entry]) => {
        if (!entry || isDestroyed(app)) return;
        if (!entry.isIntersecting) app.ticker.stop();
        else if (activeCallbacks !== 0) app.ticker.start();
      });
      const resize = new ResizeObserver(() => {
        if (isDestroyed(app)) return;
        app.renderer.resize(canvas.clientWidth, canvas.clientHeight);
        app.renderer.render(app.stage);
      });
      visibility.observe(canvas);
      resize.observe(canvas);
      cleanups.push(() => {
        clearTimeout(revealTimer);
        resize.disconnect();
        visibility.disconnect();
      });
    };

    const startTimer = window.setTimeout(() => {
      start().catch((cause: unknown) => {
        if (cause instanceof PixiCanvasError) throw cause;
        throw new PixiCanvasError("setup_failed", "pixi canvas failed to start", { cause });
      });
    }, 1);

    return () => {
      disposed = true;
      clearTimeout(startTimer);
      cleanups.reverse().forEach((cleanup) => cleanup());
    };
  }, []);

  return <canvas className={cn(className, "!touch-auto")} ref={ref} style={{ opacity: 0 }} />;
}
