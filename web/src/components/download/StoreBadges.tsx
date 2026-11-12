import type { CSSProperties } from "react";

const PILL: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "10px 18px",
  borderRadius: "9999px",
  background: "rgba(0,0,0,0.04)",
  fontSize: "14px",
  lineHeight: "20px",
  color: "rgba(10,10,10,0.72)",
};
const DOT: CSSProperties = { width: "6px", height: "6px", borderRadius: "9999px", background: "rgba(10,10,10,0.32)" };
const LIVE_DOT: CSSProperties = { ...DOT, background: "#34d399" };

/** Where Lunar runs: Android now, the App Store later. */
export function StoreBadges() {
  return (
    <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
      <div style={PILL}>
        <span style={LIVE_DOT} />
        Android 8.0+ · available now
      </div>
      <div style={PILL}>
        <span style={DOT} />
        App Store · coming soon
      </div>
    </div>
  );
}
