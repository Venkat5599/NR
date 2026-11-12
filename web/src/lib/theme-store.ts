import { useState } from "react";
import { CubicBezier } from "./cubic-bezier.ts";
import { TRANSITION_MS_PER_UNIT, layerStyles, progressForHour, type LayerStyle } from "./theme-layers.ts";

type Listener = (progress: number) => void;
type Signal = () => void;

const curve = new CubicBezier(0.25, 0.1, 0.25, 1);
const changeListeners = new Set<Listener>();
const startListeners = new Set<Signal>();
const endListeners = new Set<Signal>();

let current = 0;
let target = 0;
let frame: number | null = null;
let startedAt: number | null = null;
let from = 0;
let initialised = false;

function emit(): void {
  changeListeners.forEach((listener) => listener(current));
}

function step(now: number): void {
  if (startedAt === null) {
    startedAt = now;
    from = current;
  }
  const duration = TRANSITION_MS_PER_UNIT * Math.abs(target - from);
  const linear = Math.min((now - startedAt) / duration, 1);
  current = from + (target - from) * curve.solve(Number.isNaN(linear) ? 0 : linear);
  if (duration < 25) current = target;
  emit();
  if (linear < 1) {
    startListeners.forEach((signal) => signal());
    frame = requestAnimationFrame(step);
    return;
  }
  current = target;
  emit();
  startedAt = null;
  frame = null;
  endListeners.forEach((signal) => signal());
}

export function setThemeProgress(next: number): void {
  if (frame !== null) cancelAnimationFrame(frame);
  target = next;
  if (startedAt === null && current === 0) {
    current = next;
    emit();
    return;
  }
  startedAt = null;
  frame = requestAnimationFrame(step);
}

export function getThemeProgress(): number {
  if (!initialised) {
    initialised = true;
    setThemeProgress(progressForHour(new Date().getHours()));
  }
  return current;
}

function subscribe<T>(set: Set<T>, item: T): () => void {
  set.add(item);
  return () => {
    set.delete(item);
  };
}

export const onThemeTransitionStart = (signal: Signal) => subscribe(startListeners, signal);
export const onThemeTransitionEnd = (signal: Signal) => subscribe(endListeners, signal);

/**
 * Calls `onStyleChange(layerIndex, style)` for the four theme layers now and on every
 * theme change. Returns an unsubscribe function.
 */
export function createThemedLayers(options: {
  onStyleChange: (index: number, style: LayerStyle) => void;
  overlay?: boolean;
}): () => void {
  const overlay = options.overlay ?? true;
  const apply: Listener = (progress) => {
    layerStyles(progress, overlay).forEach((style, index) => options.onStyleChange(index, style));
  };
  const unsubscribe = subscribe(changeListeners, apply);
  apply(getThemeProgress());
  return unsubscribe;
}

export function useThemeProgress(): [number, (next: number) => void] {
  const [progress, setProgress] = useState(getThemeProgress);
  const update = (next: number) => {
    setThemeProgress(next);
    setProgress(next);
  };
  return [progress, update];
}
