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
