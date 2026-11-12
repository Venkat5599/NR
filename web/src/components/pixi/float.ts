/** A slow horizontal sway: a sine wave with its own phase, amplitude and period. */
export type Float = { phase: number; amplitude: number; period: number; startedAt: number };

export function floatOffset(float: Float, now: number): number {
  const turn = ((now - float.startedAt) % float.period) / float.period;
  return Math.sin(float.phase + turn * Math.PI * 2) * float.amplitude;
}
