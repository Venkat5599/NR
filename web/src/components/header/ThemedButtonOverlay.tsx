"use client";

import { useEffect, useRef } from "react";
import { createThemedLayers } from "@/lib/theme-store";
import { THEMES } from "@/lib/theme-layers";

/** The frosted, time-of-day tinted glass behind header controls. */
export function ThemedButtonOverlay() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const layers = Array.from(ref.current?.children ?? []);
    return createThemedLayers({
      overlay: false,
      onStyleChange: (index, style) => {
        const layer = layers[index];
        if (!(layer instanceof HTMLElement)) return;
        layer.style.opacity = style.alpha.toString();
        layer.style.display = style.alpha > 0 ? "block" : "none";
      },
    });
  }, []);
  return (
    <div className="overlay pointer-events-none" ref={ref}>
      {THEMES.map((theme) => (
        <div className="overlay" data-theme={theme} key={theme} style={{ opacity: 0 }}>
          {[0, 1, 2, 3].map((layer) => (
            <div className="overlay header-button-overlay-background transition contain-layout contain-paint" key={layer} />
          ))}
          <div className="overlay header-button-overlay-border mask-border p-1 contain-layout contain-paint" />
          <div className="overlay header-button-overlay-shadow contain-layout contain-paint" />
        </div>
      ))}
    </div>
  );
}
