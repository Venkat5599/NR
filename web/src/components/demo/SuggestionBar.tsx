"use client";

type Props = {
  /** Action chips (filled), from what the sentence is about. */
  actions: readonly { label: string; onClick: () => void }[];
  /** Word suggestions, likeliest first. */
  words: readonly string[];
  onWord: (w: string) => void;
  /** Shown when there is nothing to suggest: the live price and the pocket. */
  idle: string;
  onNewPayment: () => void;
};

function Crescent() {
  return (
    <svg aria-hidden="true" className="bar-mark" fill="none" height="18" viewBox="0 0 48 48" width="18">
      <path d="M39.557 30.854A17 17 0 1 1 22.562 7.061A14.62 14.62 0 1 0 39.557 30.854Z" fill="currentColor" />
    </svg>
  );
}

/** The bar above the keys while typing: action chips, then words (the likeliest in the middle). */
export function SuggestionBar({ actions, words, onWord, idle, onNewPayment }: Props) {
  const typing = actions.length > 0 || words.length > 0;
  const ordered = words.length === 3 ? [words[1], words[0], words[2]] : words;
  return (
    <div className="bar" data-testid="bar">
      <Crescent />
      <div className="bar-scroll">
        {typing ? (
          <>
            {actions.map((a) => (
              <button className="bar-chip bar-chip-lead" key={a.label} onClick={a.onClick} type="button">
                {a.label}
              </button>
            ))}
            {ordered.map((w) =>
              w === undefined ? null : (
                <button className={w === words[0] ? "bar-word bar-word-top" : "bar-word"} key={w} onClick={() => onWord(w)} type="button">
                  {w}
                </button>
              ),
            )}
          </>
        ) : (
          <button className="bar-chip bar-chip-lead" onClick={onNewPayment} type="button">
            {"New payment"}
          </button>
        )}
      </div>
      {!typing && idle !== "" && <span className="bar-idle">{idle}</span>}
    </div>
  );
}
