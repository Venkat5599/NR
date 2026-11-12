"use client";

import { PixiCanvas } from "@/components/pixi/PixiCanvas";
import { driftingClouds, glitchSlices, restingPortrait, type ApproverId } from "./scenes";

/** A portrait that glitches between two looks; hovering makes it glitch harder. */
export function ApproverPortrait({ id }: { id: ApproverId }) {
  return (
    <PixiCanvas
      className="overlay"
      fps={40}
      initOptions={{ background: "#fff" }}
      setups={[restingPortrait(id), glitchSlices(id), driftingClouds]}
    />
  );
}
