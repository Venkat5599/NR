import { LunarError } from "../errors.ts";

const DECIMALS = 24;
const ONE_NEAR = 10n ** 24n;
const DECIMAL = /^(\d{1,9})(?:\.(\d{1,24}))?$/;

/** "0.05" -> 50000000000000000000000n. Rejects anything that is not a plain decimal. */
export function nearToYocto(amount: string): bigint {
  const m = DECIMAL.exec(amount.trim());
  if (!m) throw new LunarError("bad_input", "amount must be a decimal number of NEAR, e.g. 0.05");
  const whole = m[1] ?? "0";
  const frac = (m[2] ?? "").padEnd(DECIMALS, "0");
  return BigInt(whole) * ONE_NEAR + BigInt(frac);
}

/** 50000000000000000000000n -> "0.05". */
export function yoctoToNear(yocto: bigint | string): string {
  const value = typeof yocto === "bigint" ? yocto : BigInt(yocto);
  const sign = value < 0n ? "-" : "";
  const abs = value < 0n ? -value : value;
  const whole = abs / ONE_NEAR;
  const frac = (abs % ONE_NEAR).toString().padStart(DECIMALS, "0").replace(/0+$/, "");
  return frac ? `${sign}${whole}.${frac}` : `${sign}${whole}`;
}

/** Rounds down to [places] decimals for display. */
export function roundNear(near: string, places: number): string {
  const [whole, frac = ""] = near.split(".");
  const cut = frac.slice(0, places).replace(/0+$/, "");
  return cut ? `${whole}.${cut}` : (whole ?? "0");
}

export const ONE_NEAR_YOCTO = ONE_NEAR;
