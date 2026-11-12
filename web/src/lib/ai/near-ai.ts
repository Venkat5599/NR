import { LunarError } from "../errors.ts";
import { isRecord, list, record, text } from "../json.ts";

export const NEARAI_URL = "https://cloud-api.near.ai/v1/chat/completions";
export const DEFAULT_MODEL = "deepseek/deepseek-v3.2";
const TIMEOUT_MS = 20_000;

export const SYSTEM_PROMPT = [
  "You read one sentence typed into a phone keyboard and say whether it asks to pay someone.",
  "Reply with one JSON object and nothing else:",
  '{"isPayment": boolean, "payee": string|null, "amount": string|null, "token": "NEAR"|"USDC"|"USDT"|null, "memo": string|null, "reason": string|null}.',
  "payee is a NEAR account name copied exactly as typed (for example bob.near or alice.testnet). Never invent, guess or complete a name.",
  'amount is a plain decimal string such as "12.5". Words like "a fiver" mean 5. "$" or "dollars" means USDC; no token means NEAR.',
  "memo is what the payment is for, if said. If there is no full NEAR name or no amount, isPayment is false and reason says what is missing.",
].join(" ");

export type ModelConfig = { apiKey: string; model: string };

/** Reads the model config from the environment; AI parsing is off without a key. */
export function modelConfig(env: Record<string, string | undefined>): ModelConfig {
  const apiKey = env["NEARAI_API_KEY"]?.trim() ?? "";
  if (apiKey === "") throw new LunarError("not_configured", "AI parsing needs NEARAI_API_KEY");
  const model = env["NEARAI_MODEL"]?.trim() || DEFAULT_MODEL;
  return { apiKey, model };
}

/** The assistant message content from an OpenAI-style chat completion. */
export function completionContent(body: unknown): string {
  const choices = list(record(body, "completion")["choices"], "completion choices");
  const first = choices[0];
  if (!isRecord(first)) throw new LunarError("upstream", "completion has no choices");
  return text(record(first["message"], "completion message")["content"], "completion content");
}

async function complete(sentence: string, config: ModelConfig, jsonMode: boolean): Promise<Response> {
  try {
    return await fetch(NEARAI_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        max_tokens: 200,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: sentence },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (cause) {
    throw new LunarError("upstream", "NEAR AI Cloud did not answer", { cause });
  }
}

/** Asks the model to extract a payment in JSON mode, or in plain mode when the model refuses JSON mode. */
export async function askModel(sentence: string, config: ModelConfig): Promise<string> {
  let response = await complete(sentence, config, true);
  if (response.status === 400 || response.status === 422) response = await complete(sentence, config, false);
  if (!response.ok) throw new LunarError("upstream", `NEAR AI Cloud answered ${response.status}`);
  const body: unknown = await response.json().catch((cause: unknown) => {
    throw new LunarError("upstream", "NEAR AI Cloud sent a body that is not JSON", { cause });
  });
  return completionContent(body);
}
