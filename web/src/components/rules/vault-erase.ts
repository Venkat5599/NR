import { Container, FillGradient, Graphics, Sprite } from "pixi.js";
import { loadTexture } from "@/components/pixi/load";
import type { SceneSetup } from "@/components/pixi/scene";

const FADE_PER_FRAME = 0.02;

/** A frosted mask over the app icon; moving the pointer erases soft holes that heal over time. */
export const setupVaultErase: SceneSetup = async ({ app, canvas, add }) => {
  const host = canvas.closest(".vault-app");
  const frost = new Container();
  const mask = new Sprite(await loadTexture("/assets/rules/app-mask.avif"));
  mask.width = canvas.clientWidth;
  mask.height = canvas.clientHeight;
  frost.addChild(mask);
  app.stage.addChild(frost);

  const holes: Graphics[] = [];
  const surface = new Container();
  surface.addChild(new Graphics().rect(0, 0, canvas.clientWidth, canvas.clientHeight).fill({ color: 0, alpha: 0 }));
  surface.eventMode = "static";
  app.stage.interactiveChildren = true;
  app.stage.addChild(surface);
  surface.on("mousemove", (event) => {
    const hole = new Graphics().circle(0, 0, 10).fill(
      new FillGradient({
        type: "radial",
        colorStops: [
          { offset: 0, color: 0xffffff },
          { offset: 1, color: "rgba(255, 255, 255, 0)" },
        ],
      }),
    );
    hole.x = event.global.x;
    hole.y = event.global.y;
    hole.alpha = 1;
    hole.blendMode = "erase";
    frost.addChild(hole);
    holes.push(hole);
  });
  add(() => {
    for (let index = holes.length - 1; index >= 0; index--) {
      const hole = holes[index];
      if (!hole) continue;
      hole.alpha -= FADE_PER_FRAME;
      if (hole.alpha <= 0) {
        frost.removeChild(hole);
        holes.splice(index, 1);
      }
    }
  });
  host?.classList.remove("opacity-0");
};
