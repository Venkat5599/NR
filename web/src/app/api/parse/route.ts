import { askModel, modelConfig } from "@/lib/ai/near-ai";
import { interpretModelReply, modelJson, readSentence } from "@/lib/ai/parse-rules";
import { fail, ok, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Asks NEAR AI Cloud to read one sentence as a payment. The sentence is never stored or logged. */
export async function POST(request: Request): Promise<Response> {
  try {
    const sentence = readSentence(await readJson(request));
    const config = modelConfig(process.env);
    const reply = modelJson(await askModel(sentence, config));
    return ok({ ...interpretModelReply(reply, sentence), model: config.model });
  } catch (error) {
    return fail(error);
  }
}

/** A browser visit gets the contract of this route instead of an empty 405. */
export function GET(): Response {
  return ok({
    route: "POST /api/parse",
    body: { sentence: "pay lunar-69787.testnet two and a half near for lunch" },
    returns: "{ isPayment, payee, amount, token, memo, model } or { isPayment: false, reason }",
    note: "Reads one sentence with a model on NEAR AI Cloud. Only full NEAR names the user typed can become a payee. Try it on /demo.",
    model: modelConfig(process.env).model,
  });
}
