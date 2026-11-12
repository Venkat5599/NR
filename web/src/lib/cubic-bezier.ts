/** Cubic-bezier timing curve solver, same algorithm as the browser's `cubic-bezier()`. */
export class CubicBezier {
  private readonly cx: number;
  private readonly bx: number;
  private readonly ax: number;
  private readonly cy: number;
  private readonly by: number;
  private readonly ay: number;

  constructor(x1: number, y1: number, x2: number, y2: number) {
    this.cx = 3 * x1;
    this.bx = 3 * (x2 - x1) - this.cx;
    this.ax = 1 - this.cx - this.bx;
    this.cy = 3 * y1;
    this.by = 3 * (y2 - y1) - this.cy;
    this.ay = 1 - this.cy - this.by;
  }

  private sampleX(t: number): number {
    return ((this.ax * t + this.bx) * t + this.cx) * t;
  }

  private sampleY(t: number): number {
    return ((this.ay * t + this.by) * t + this.cy) * t;
  }

  private sampleDerivativeX(t: number): number {
    return (3 * this.ax * t + 2 * this.bx) * t + this.cx;
  }

  private solveX(x: number, epsilon: number): number {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const error = this.sampleX(t) - x;
      if (Math.abs(error) < epsilon) return t;
      const slope = this.sampleDerivativeX(t);
      if (Math.abs(slope) < epsilon) break;
      t -= error / slope;
    }
    let low = 0;
    let high = 1;
    t = x;
    if (t < low) return low;
    if (t > high) return high;
    while (low < high) {
      const value = this.sampleX(t);
      if (Math.abs(value - x) < epsilon) break;
      if (x > value) low = t;
      else high = t;
      t = (high - low) * 0.5 + low;
    }
    return t;
  }

  solve(x: number, epsilon = 1e-6): number {
    return this.sampleY(this.solveX(x, epsilon));
  }
}

const standardEase = new CubicBezier(0.25, 0.1, 0.25, 1);

/** CSS `ease`, clamped to [0, 1]. */
export function ease(progress: number): number {
  if (progress <= 0) return 0;
  if (progress >= 1) return 1;
  return standardEase.solve(progress);
}
