export const REPO_URL = "https://github.com/Venkat5599/NR";
export const REPO_SLUG = "Venkat5599/NR";
export const README_URL = `${REPO_URL}#readme`;
export const EVIDENCE_URL = `${REPO_URL}/blob/main/docs/EVIDENCE.md`;
export const APK_URL = `${REPO_URL}/releases/latest/download/lunar.apk`;

export const SITE_TITLE = "Lunar · Safe AI keyboard";
export const SITE_DESCRIPTION = "The AI keyboard that won't let you send money to the wrong place.";

export const HERO_LABELS = ["Pay by name bob.near", "Wrong network comes back"] as const;

export type Part = { id: string; title: string; tags: string[] };

/** The four parts shown in section 05, in display order (two rows of two). */
export const PARTS: Part[] = [
  { id: "vault", title: "Payments contract", tags: ["Rust", "NEAR"] },
  { id: "builder", title: "Receive address", tags: ["Base", "EVM", "Refund"] },
  { id: "guardians", title: "Keyboard", tags: ["Android"] },
  { id: "proof", title: "Public record", tags: ["Public", "Read-only"] },
];

/** Rule tiles that open a details card on hover; tiles without an entry are plain images. */
export const RULE_DETAILS: Record<string, { title: string; tags: string[] }> = {
  "r-keyless": { title: "Keyless address", tags: ["No admin key"] },
  "r-limit": { title: "Daily cap", tags: ["Every chain", "USD"] },
  "r-delay": { title: "Pay by name", tags: ["No pasted address"] },
  "r-saved": { title: "Saved payees", tags: ["Checked every time"] },
  "r-rules": { title: "Cap changes in wallet", tags: ["Raise", "Lower"] },
  "r-cancel": { title: "Paste check", tags: ["Before you sign"] },
  "r-phonekey": { title: "Scoped keyboard key", tags: ["Pay", "Nothing else"] },
  "r-usd": { title: "One cap, every chain", tags: ["Summed across chains"] },
  "r-topup": { title: "Private AI", tags: ["Enclave"] },
};

export const RULE_ROWS: string[][] = [
  ["r-keyless", "r-limit", "r-delay", "r-saved", "r-rules", "r-cancel", "r-freeze", "r-majority"],
  ["r-duress", "r-phonekey", "r-builder", "r-change", "r-usd", "r-proof", "r-mpc", "r-topup"],
];

export const SETTLEMENT_CHAINS = ["Base", "BNB", "Polygon", "NEAR", "NEAR Intents"] as const;

export type Quote = { text: string; highlight: string };

export const QUOTES: Quote[] = [
  { text: "“ A typo should cost nothing. ”", highlight: "nothing" },
  { text: "“ You pay a name, never a pasted address. ”", highlight: "a name" },
  { text: "“ Money on the wrong network comes back on its own. ”", highlight: "comes back" },
  { text: "“ The keyboard key can pay a little and nothing else. ”", highlight: "a little" },
  { text: "“ A lookalike address is caught before you sign. ”", highlight: "caught" },
  { text: "“ One cap, every chain, no weak chain to pick on. ”", highlight: "One cap" },
  { text: "“ The AI reads one sentence, inside an enclave. ”", highlight: "one sentence" },
  { text: "“ Bigger payments open your own wallet. ”", highlight: "your own wallet" },
  { text: "“ Every save has a transaction link. ”", highlight: "transaction link" },
];

export const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Parts", href: "/#parts" },
  { label: "Guarantee", href: "/#guarantee" },
  { label: "Demo", href: "/demo" },
  { label: "Record", href: "/record" },
] as const;
