import { test } from "node:test";
import assert from "node:assert/strict";
import { askModel, modelConfig } from "../src/lib/ai/near-ai.ts";
import { interpretModelReply, modelJson } from "../src/lib/ai/parse-rules.ts";

const live = process.env["NEARAI_API_KEY"] ? test : test.skip;

live("NEAR AI Cloud reads a free-form sentence into a payment the user typed", async () => {
  const sentence = "send bob.testnet a fiver for the cab";
  const reply = modelJson(await askModel(sentence, modelConfig(process.env)));
  const out = interpretModelReply(reply, sentence);
  assert.ok(out.isPayment, JSON.stringify(out));
  assert.equal(out.payee, "bob.testnet");
  assert.equal(out.amount, "5");
});

live("NEAR AI Cloud does not turn a bare first name into an account", async () => {
  const sentence = "send bob a fiver";
  const out = interpretModelReply(modelJson(await askModel(sentence, modelConfig(process.env))), sentence);
  assert.equal(out.isPayment, false);
});
