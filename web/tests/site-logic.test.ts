import { test } from "node:test";
import assert from "node:assert/strict";
import { QUOTES } from "../src/lib/content.ts";
import { highlightRange, nextQuote, quoteWords } from "../src/lib/quotes.ts";
import { layerStyles, progressForHour, snapProgress } from "../src/lib/theme-layers.ts";

const ORIGINAL_RANGES: Array<[number, number]> = [
  [21, 28],
  [10, 16],
  [29, 39],
  [27, 35],
  [25, 31],
  [2, 9],
  [15, 27],
  [23, 38],
  [19, 35],
];

test("quote highlights cover the same letters as the shipped site", () => {
  QUOTES.forEach((quote, index) => {
    const { start, end } = highlightRange(quote);
    assert.deepEqual([start, end], ORIGINAL_RANGES[index]);
    const highlighted = quoteWords(quote)
      .flatMap((word) => word.letters)
      .filter((letter) => letter.highlighted)
      .map((letter) => letter.char)
      .join("");
    assert.equal(highlighted, quote.highlight.replaceAll(" ", ""));
  });
});

test("quotes rotate in order and wrap around", () => {
  const last = QUOTES[QUOTES.length - 1];
  assert.ok(last);
  assert.equal(nextQuote(QUOTES, last), QUOTES[0]);
});

test("time of day maps to the four themes", () => {
  assert.equal(progressForHour(9), 0);
  assert.equal(progressForHour(13), 1 / 3);
  assert.equal(progressForHour(17), 2 / 3);
  assert.equal(progressForHour(22), 1);
  assert.equal(progressForHour(2), 1);
});

test("layers cross-fade between neighbouring themes", () => {
  const styles = layerStyles(1 / 6, false);
  assert.ok(Math.abs((styles[0]?.alpha ?? 0) - 0.5) < 1e-9);
  assert.ok(Math.abs((styles[1]?.alpha ?? 0) - 0.5) < 1e-9);
  assert.deepEqual(layerStyles(1, true)[3], { alpha: 1, zIndex: 1 });
});

test("the dial snaps to a named time when close to it", () => {
  assert.equal(snapProgress(0.36), 1 / 3);
  assert.equal(snapProgress(0.5), 0.5);
});
