import type { CSSProperties } from "react";
import { APK_URL } from "@/lib/content";

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

const DOWNLOAD_PILL: CSSProperties = { ...PILL, background: "rgba(10,10,10,0.86)", color: "rgba(255,255,255,0.92)", textDecoration: "none" };
const DOWNLOAD_DOT: CSSProperties = { ...DOT, background: "#34d399" };

/** Where to get Lunar: the Android APK now, the App Store later. */
export function StoreBadges() {
  return (
    <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap", marginBottom: "28px" }}>
      <div style={PILL}>
        <span style={DOT} />
        App Store · coming soon
      </div>
      <a download href={APK_URL} style={DOWNLOAD_PILL}>
        <span style={DOWNLOAD_DOT} />
        Android · Download APK
      </a>
    </div>
  );
}
