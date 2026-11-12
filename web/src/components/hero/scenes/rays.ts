import { Container, FillGradient, Graphics, Sprite, type Application } from "pixi.js";
import { degreesToRadians, delay, renderToTexture, waitUntilReady, yieldToMain, type SceneSetup } from "@/components/pixi/scene";
import { HERO_CENTER_Y } from "../constants";

const COLUMN_OFFSET = 397;
const CENTER_COLUMN_SCALE = 0.36885;

function fadedLineTexture(app: Application, width: number) {
  const line = new Graphics().rect(0, 0, width, 1).fill(
    new FillGradient({
      type: "linear",
      colorStops: [
        { offset: 0, color: "transparent" },
        { offset: 0.05, color: "#ffffff14" },
        { offset: 0.95, color: "#ffffff14" },
        { offset: 1, color: "transparent" },
      ],
      textureSpace: "global",
      start: { x: 0, y: 0 },
      end: { x: width, y: 0 },
    }),
  );
  return renderToTexture(app, line);
}

/** Faint rays through the moon and three vertical guide lines, drawn outward once. */
export const setupRays: SceneSetup = async ({ app, canvas, add, remove }) => {
  const group = new Container();
  group.zIndex = 100;
  app.stage.addChild(group);

  const texture = fadedLineTexture(app, canvas.clientWidth);
  const rayLength = Math.max(2048, canvas.clientWidth);
  const rays = [0, 1, 2, 3, 4].map((index) => {
    const ray = new Sprite({ texture, x: canvas.clientWidth / 2, y: HERO_CENTER_Y, width: rayLength, height: 1 });
    ray.anchor.set(0.5, 0.5);
    ray.rotation = index > 2 ? degreesToRadians(-135 + (index - 3) * 90) : degreesToRadians(-15 + 15 * index);
    ray.width = 0;
    group.addChild(ray);
    return ray;
  });

  const columnLength = Math.max(2048, canvas.clientHeight);
  const columns = [0, 1, 2].map((index) => {
    const column = new Graphics().rect(0, 0, columnLength, 1).fill("#ffffff14");
    column.x = canvas.clientWidth / 2 + (index === 0 ? -COLUMN_OFFSET : index === 1 ? COLUMN_OFFSET : 0);
    column.y = 0;
    column.pivot.set(0.5, 0.5);
    column.scale.x = 0;
    column.rotation = degreesToRadians(90);
    group.addChild(column);
    return column;
  });
  const centerColumn = columns[2];

  const grow = () => {
    let done = true;
    rays.forEach((ray) => {
      ray.width = Math.min(ray.width + 30 + 10 * Math.random(), rayLength);
      if (ray.width < rayLength) done = false;
    });
    columns.forEach((column) => {
      const limit = column === centerColumn ? CENTER_COLUMN_SCALE : 1;
      const step = column === centerColumn ? 0.005 : 0.05;
      column.scale.x = Math.min(column.scale.x + step, limit);
      column.y = HERO_CENTER_Y - column.width / 2;
      if (column.scale.x < limit) done = false;
    });
    if (!done) return;
    remove(grow);
    group.cacheAsTexture(true);
  };

  app.renderer.on("resize", () => {
    rays.forEach((ray) => {
      ray.x = canvas.clientWidth / 2;
    });
    columns.forEach((column, index) => {
      column.x = canvas.clientWidth / 2 + (index === 0 ? -COLUMN_OFFSET : index === 1 ? COLUMN_OFFSET : 0);
    });
    group.updateCacheTexture();
  });

  await waitUntilReady(canvas);
  await yieldToMain();
  await delay(1000);
  add(grow);
};
