import { LunarError, STATUS_BY_CODE } from "./errors.ts";

const NO_STORE = { "cache-control": "no-store" };

export function ok(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

/** Maps a coded error to its status at the route boundary; anything else is a bug and propagates. */
export function fail(error: unknown): Response {
  if (!(error instanceof LunarError)) throw error;
  return Response.json(
    { error: { code: error.code, message: error.message } },
    { status: STATUS_BY_CODE[error.code], headers: NO_STORE },
  );
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch (cause) {
    throw new LunarError("bad_input", "body must be JSON", { cause });
  }
}

/** The caller's address as the proxy reports it; one shared bucket when none is given. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "local";
}
