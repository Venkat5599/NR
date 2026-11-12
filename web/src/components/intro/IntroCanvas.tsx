"use client";

import dynamic from "next/dynamic";
import { PixiCanvas } from "@/components/pixi/PixiCanvas";
import type { SceneSetup } from "@/components/pixi/scene";
import { useMediaQuery } from "@/lib/use-media-query";
import { setupDitherSpotlight } from "./scenes/dither-spotlight";
import { setupFloatingCloud } from "./scenes/floating-cloud";

const INTRO_SETUPS: SceneSetup[] = [setupFloatingCloud, setupDitherSpotlight];

function IntroScene() {
  const compact = useMediaQuery("(max-width: 968px)");
  if (compact) return null;
  return (
    <PixiCanvas
      className="overlay pointer-events-none z-[10]"
      fps={10}
      initOptions={{ backgroundAlpha: 0 }}
      setups={INTRO_SETUPS}
    />
  );
}

/** The drifting cloud and the dither lens over the intro section; desktop only. */
export const IntroCanvas = dynamic(() => Promise.resolve(IntroScene), { ssr: false });
