"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { createThemedLayers } from "@/lib/theme-store";
import { THEMES } from "@/lib/theme-layers";
import { ThemedButtonOverlay } from "./ThemedButtonOverlay";

/** The round moon badge at the top centre, tinted for the time of day. */
export function ThemedLogo() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const layers = Array.from(ref.current?.children ?? []);
    return createThemedLayers({
      overlay: false,
      onStyleChange: (index, style) => {
        const layer = layers[index];
        if (layer instanceof HTMLElement) layer.style.opacity = style.alpha.toString();
      },
    });
  }, []);
  return (
    <>
      <div className="absolute inset-3 rounded-full" ref={ref}>
        {THEMES.map((theme) => (
          <div className="overlay" data-theme={theme} key={theme} style={{ opacity: 0 }}>
            <div className="overlay header-logo-overlay blur-[1px]" />
            <Image alt="Lunar" className="absolute inset-0" height={64} src={`/assets/header/${theme}-logo.avif`} width={64} />
          </div>
        ))}
      </div>
      <ThemedButtonOverlay />
    </>
  );
}
