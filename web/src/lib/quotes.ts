import type { Quote } from "./content.ts";

export type QuoteLetter = { char: string; position: number; highlighted: boolean };
export type QuoteWord = { letters: QuoteLetter[] };

/** Character range of the highlighted phrase inside the quote text. */
export function highlightRange(quote: Quote): { start: number; end: number } {
  const start = quote.text.indexOf(quote.highlight);
  if (start < 0) throw new RangeError(`highlight "${quote.highlight}" not found in "${quote.text}"`);
  return { start, end: start + quote.highlight.length };
}

/**
 * Splits a quote into words of letters. `position` is the letter's offset used for the
 * staggered reveal and the highlight test; it matches the string index for every word
 * after the first.
 */
export function quoteWords(quote: Quote): QuoteWord[] {
  const { start, end } = highlightRange(quote);
  const words = quote.text.split(" ");
  return words.map((word, wordIndex) => {
    const offset = words.slice(0, wordIndex).join(" ").length;
    return {
      letters: word.split("").map((char, charIndex) => {
        const position = offset + charIndex + 1;
        return { char, position, highlighted: position >= start && position < end };
      }),
    };
  });
}

export function nextQuote(quotes: Quote[], current: Quote): Quote {
  const index = quotes.findIndex((quote) => quote.text === current.text);
  const next = quotes[(index + 1) % quotes.length];
  if (!next) throw new RangeError("quote list is empty");
  return next;
}
