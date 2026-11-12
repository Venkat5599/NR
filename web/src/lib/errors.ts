export type ErrorCode = "bad_input" | "not_found" | "rate_limited" | "upstream" | "chain" | "not_configured";

/** An error the API can explain to its caller; the route maps the code to an HTTP status. */
export class LunarError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "LunarError";
    this.code = code;
  }
}

export const STATUS_BY_CODE: Record<ErrorCode, number> = {
  bad_input: 400,
  not_found: 404,
  rate_limited: 429,
  upstream: 502,
  chain: 502,
  not_configured: 503,
};
