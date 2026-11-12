type ClassValue = string | false | null | undefined | Record<string, boolean> | ClassValue[];

/** Joins class names, skipping falsy values; object keys are included when their value is true. */
export function cn(...values: ClassValue[]): string {
  const out: string[] = [];
  for (const value of values) {
    if (!value) continue;
    if (typeof value === "string") out.push(value);
    else if (Array.isArray(value)) {
      const nested = cn(...value);
      if (nested) out.push(nested);
    } else {
      for (const [name, enabled] of Object.entries(value)) if (enabled) out.push(name);
    }
  }
  return out.join(" ");
}
