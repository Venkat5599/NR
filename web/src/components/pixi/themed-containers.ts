import type { Container } from "pixi.js";
import { createThemedLayers } from "@/lib/theme-store";

/** Cross-fades one container per theme as the time of day changes. Returns an unsubscribe. */
export function createThemedContainers(containers: readonly Container[]): () => void {
  return createThemedLayers({
    onStyleChange: (index, style) => {
      const container = containers[index];
      if (!container) return;
      container.alpha = style.alpha;
      container.zIndex = style.zIndex;
      container.visible = style.alpha > 0;
    },
  });
}
