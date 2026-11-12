import { LunarError } from "@/lib/errors";
import { fail, ok } from "@/lib/http";
import { nearToYocto } from "@/lib/near/amount";
import { checkName, readAccountParam } from "@/lib/name-check/check";

export const dynamic = "force-dynamic";

function readAmount(raw: string | null): string | null {
  if (raw === null || raw.trim() === "") return null;
  if (nearToYocto(raw) <= 0n) throw new LunarError("bad_input", "amount must be above zero");
  return raw.trim();
}

/** Whether a name exists, how old its keys are, where it wants to be paid and a live quote for that. */
export async function GET(request: Request): Promise<Response> {
  try {
    const params = new URL(request.url).searchParams;
    return ok(await checkName(readAccountParam(params.get("account")), readAmount(params.get("amount"))));
  } catch (error) {
    return fail(error);
  }
}
