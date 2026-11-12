import { LunarError, type ErrorCode } from "./errors.ts";

export type JsonRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function record(value: unknown, what: string, code: ErrorCode = "upstream"): JsonRecord {
  if (!isRecord(value)) throw new LunarError(code, `${what} is not an object`);
  return value;
}

export function text(value: unknown, what: string, code: ErrorCode = "upstream"): string {
  if (typeof value !== "string") throw new LunarError(code, `${what} is not a string`);
  return value;
}

export function list(value: unknown, what: string, code: ErrorCode = "upstream"): unknown[] {
  if (!Array.isArray(value)) throw new LunarError(code, `${what} is not a list`);
  return value;
}

export function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Parses JSON text, turning a syntax error into a coded error. */
export function parseJson(raw: string, what: string, code: ErrorCode = "upstream"): unknown {
  try {
    return JSON.parse(raw);
  } catch (cause) {
    throw new LunarError(code, `${what} is not valid JSON`, { cause });
  }
}
