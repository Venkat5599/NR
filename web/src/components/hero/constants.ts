import { THEMES, type Theme } from "@/lib/theme-layers";

export const REVEAL_FPS = 60;
export const FLOATING_FPS = 20;
export const THEME_TRANSITION_FPS = 60;

export const HERO_HEIGHT = 1460;
export const HERO_CENTER_Y = 517.5;

export const DOT_URL = "/assets/hero/dot.avif";
export const DOT_SOLID_URL = "/assets/hero/dot-solid.avif";
export const DOT_GLOW_URL = "/assets/hero/dot-glow.avif";
export const LINES_URL = "/assets/hero/lines.avif";
export const RING_URLS = [4, 3, 2, 1].map((index) => `/assets/hero/lines-center-${index}.avif`);
export const CLOUD_URLS = [1, 2, 3, 4].map((index) => `/assets/hero/clouds-${index}.avif`);

export const backgroundUrl = (theme: Theme) => `/assets/hero/base/${theme}/background.png`;
export const moonUrl = (theme: Theme) => `/assets/hero/${theme}/moon.avif?v=3`;
export const titleUrl = (theme: Theme, line: number) => `/assets/hero/${theme}/text/${line}.avif`;

export const TITLE_LINES = [1, 2, 3, 4] as const;

export const HERO_ASSET_URLS: string[] = [
  ...THEMES.flatMap((theme) => [backgroundUrl(theme), moonUrl(theme), ...TITLE_LINES.map((line) => titleUrl(theme, line))]),
  DOT_URL,
  DOT_SOLID_URL,
  DOT_GLOW_URL,
  ...RING_URLS,
  LINES_URL,
  ...CLOUD_URLS,
];

/** 0 at 500px wide and below, 1 at 1200px and above; scales hero pieces for narrow screens. */
export function heroScale(width: number): number {
  if (width >= 1200) return 1;
  if (width <= 500) return 0;
  return (width - 500) / 700;
}
