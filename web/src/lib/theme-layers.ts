export const THEMES = ["morning", "midday", "afternoon", "night"] as const;
export type Theme = (typeof THEMES)[number];

/** Milliseconds a full morning-to-night sweep takes; shorter moves scale down linearly. */
export const TRANSITION_MS_PER_UNIT = 200;

export type LayerStyle = { alpha: number; zIndex: number };

/** Theme progress for a local hour: 0 morning, 1/3 midday, 2/3 afternoon, 1 night. */
export function progressForHour(hour: number): number {
  if (hour > 20 || hour < 4) return 1;
  if (hour >= 16) return 2 / 3;
  if (hour >= 12) return 1 / 3;
  return 0;
}

/**
 * Style for each of the four theme layers at a progress value. Two neighbouring
 * layers cross-fade; with `overlay` the lower one stays opaque underneath.
 */
export function layerStyles(progress: number, overlay: boolean): LayerStyle[] {
  const styles: LayerStyle[] = THEMES.map(() => ({ alpha: 0, zIndex: 0 }));
  if (progress === 1) {
    styles[3] = { alpha: 1, zIndex: 1 };
    return styles;
  }
  const index = Math.min(Math.floor(3 * progress), 2);
  const mix = (3 * progress) % 1;
  styles[index] = { alpha: overlay ? 1 : 1 - mix, zIndex: 1 };
  styles[(index + 1) % 4] = { alpha: mix, zIndex: 2 };
  return styles;
}

/** Snap a dragged dial value to the nearest named theme when within 0.05 of it. */
export function snapProgress(raw: number): number {
  const stops = [0, 1 / 3, 2 / 3, 1];
  const nearest = stops.reduce((best, stop) => (Math.abs(stop - raw) < Math.abs(best - raw) ? stop : best));
  return Math.abs(nearest - raw) <= 0.05 ? nearest : raw;
}
