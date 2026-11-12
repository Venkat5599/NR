import { test } from "node:test";
import assert from "node:assert/strict";
import { completionContent, modelConfig, DEFAULT_MODEL } from "../src/lib/ai/near-ai.ts";
import { interpretModelReply, MAX_SENTENCE, modelJson, readSentence, typedInSentence } from "../src/lib/ai/parse-rules.ts";
import { LunarError, STATUS_BY_CODE } from "../src/lib/errors.ts";

function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    if (error instanceof LunarError) return error.code;
    throw error;
  }
  return "none";
}

test("sentence must be a non-empty string of at most 300 characters", () => {
  assert.equal(readSentence({ sentence: "  send bob.near a fiver  " }), "send bob.near a fiver");
  assert.equal(codeOf(() => readSentence({})), "bad_input");
  assert.equal(codeOf(() => readSentence({ sentence: 5 })), "bad_input");
  assert.equal(codeOf(() => readSentence({ sentence: "   " })), "bad_input");
  assert.equal(codeOf(() => readSentence({ sentence: "x".repeat(MAX_SENTENCE + 1) })), "bad_input");
  assert.equal(readSentence({ sentence: "x".repeat(MAX_SENTENCE) }).length, MAX_SENTENCE);
});

test("bad input maps to 400, upstream to 502 and a missing key to 503", () => {
  assert.equal(STATUS_BY_CODE.bad_input, 400);
  assert.equal(STATUS_BY_CODE.upstream, 502);
  assert.equal(STATUS_BY_CODE.not_configured, 503);
});

test("AI parsing is off without NEARAI_API_KEY and defaults the model", () => {
  assert.equal(codeOf(() => modelConfig({})), "not_configured");
  assert.equal(codeOf(() => modelConfig({ NEARAI_API_KEY: "  " })), "not_configured");
  assert.deepEqual(modelConfig({ NEARAI_API_KEY: "k" }), { apiKey: "k", model: DEFAULT_MODEL });
  assert.equal(modelConfig({ NEARAI_API_KEY: "k", NEARAI_MODEL: "m" }).model, "m");
});

test("model JSON is read strictly, or from the first object inside prose", () => {
  assert.deepEqual(modelJson('{"isPayment":false,"reason":"x"}'), { isPayment: false, reason: "x" });
  assert.deepEqual(modelJson('Sure:\n```json\n{"isPayment":true}\n```'), { isPayment: true });
  assert.equal(codeOf(() => modelJson("no json here")), "upstream");
  assert.equal(codeOf(() => modelJson("{not json}")), "upstream");
});

test("completion content comes from the first choice", () => {
  assert.equal(completionContent({ choices: [{ message: { content: "{}" } }] }), "{}");
  assert.equal(codeOf(() => completionContent({ choices: [] })), "upstream");
});

test("payee must be a whole name the user typed", () => {
  assert.ok(typedInSentence("bob.near", "send bob.near a fiver"));
  assert.ok(typedInSentence("bob.near", "send @Bob.near a fiver"));
  assert.ok(!typedInSentence("bob.near", "send bob a fiver"));
  assert.ok(!typedInSentence("bob.near", "send rbob.near 5"));
  assert.ok(!typedInSentence("bob.near", "send bob.nearby 5"));
});

test("a payee the model invented is refused", () => {
  const out = interpretModelReply({ isPayment: true, payee: "bob.near", amount: "5" }, "send bob a fiver");
  assert.deepEqual(out, { isPayment: false, reason: "type the full NEAR name, e.g. bob.testnet" });
});

test("a valid reply becomes a payment with normalized fields", () => {
  const out = interpretModelReply({ isPayment: true, payee: "@Bob.near", amount: "5.50", token: "usd", memo: " the cab " }, "send bob.near a fiver and fifty for the cab");
  assert.deepEqual(out, { isPayment: true, payee: "bob.near", amount: "5.5", token: "USDC", memo: "the cab" });
});

test("a numeric amount is accepted and a missing token means NEAR", () => {
  const out = interpretModelReply({ isPayment: true, payee: "bob.near", amount: 2, token: null, memo: null }, "pay bob.near two");
  assert.deepEqual(out, { isPayment: true, payee: "bob.near", amount: "2", token: "NEAR", memo: null });
});

test("zero, negative or missing amounts and unknown tokens are refused", () => {
  const s = "pay bob.near";
  for (const amount of ["0", "-1", "", null, "1e5"]) {
    assert.equal(interpretModelReply({ isPayment: true, payee: "bob.near", amount }, s).isPayment, false, String(amount));
  }
  assert.equal(interpretModelReply({ isPayment: true, payee: "bob.near", amount: "1", token: "DOGE" }, s).isPayment, false);
});

test("a non-payment keeps the model's reason", () => {
  assert.deepEqual(interpretModelReply({ isPayment: false, reason: "no amount" }, "hi"), { isPayment: false, reason: "no amount" });
  assert.equal(codeOf(() => interpretModelReply([], "hi")), "upstream");
});
