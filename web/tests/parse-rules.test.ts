import { test } from "node:test";
import assert from "node:assert/strict";
import { interpretModelReply } from "../src/lib/ai/parse-rules.ts";

test("a bare first name is never a payee, even though it is a valid top-level NEAR name", () => {
  const out = interpretModelReply({ isPayment: true, payee: "bob", amount: "5" }, "send bob a fiver");
  assert.equal(out.isPayment, false);
});
