import { Button } from "@/components/ui/Button";
import { WAITLIST_ENDPOINT } from "@/lib/content";

/** Email sign-up, posted straight to the waitlist inbox; the hidden `_honey` field catches bots. */
export function WaitlistForm() {
  return (
    <>
      <form action={WAITLIST_ENDPOINT} method="POST" style={{ display: "flex", gap: "10px", justifyContent: "center", alignItems: "center", flexWrap: "wrap", maxWidth: "520px", margin: "0 auto" }}><input type="hidden" name="_subject" value="Lunar waitlist" /><input type="hidden" name="_template" value="table" /><input type="text" name="_honey" style={{ display: "none" }} tabIndex={-1} autoComplete="off" /><input type="email" name="email" required placeholder="you@example.com" autoComplete="email" aria-label="Email address" style={{ flex: "1 1 240px", minWidth: "220px", height: "48px", padding: "0 20px", borderRadius: "9999px", border: "1px solid rgba(0,0,0,0.10)", background: "#fff", fontSize: "15px", fontFamily: "inherit", color: "#0a0a0a", outline: "none", boxShadow: "0 12px 24px -12px rgba(0,0,0,0.12)" }}></input><Button className="shrink-0" size="large" type="submit">
          Join waitlist
        </Button></form>
      <div style={{ marginTop: "16px", fontSize: "13px", color: "rgba(10,10,10,0.40)", textAlign: "center" }}>
        One email when it ships. Nothing else.
      </div>
    </>
  );
}
