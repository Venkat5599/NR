import type { Metadata } from "next";
import { DemoApp } from "@/components/demo/DemoApp";
import { PasteCheckPanel } from "@/components/demo/PasteCheckPanel";
import { SiteFooter } from "@/components/footer/SiteFooter";
import { SectionDot } from "@/components/ui/SectionHeading";

export const metadata: Metadata = {
  title: "Try Lunar in your browser",
  description: "Type a payment on the Lunar keyboard and pay from a capped NEAR testnet pocket.",
};

export default function DemoPage() {
  return (
    <main className="page">
      <header className="page-head">
        <div className="page-kicker font-pixel">{"Demo · NEAR testnet"}</div>
        <h1 className="text-titles-h2 page-title">{"Try the keyboard"}</h1>
        <SectionDot />
        <p className="text-body-x-large page-lede">
          {"Type "}
          <span className="font-pixel">{"pay lunar-69787.testnet 0.05"}</span>
          {" and tap Pay. Lunar checks the name, the cap and where the payee wants to be paid, then pays with a key that can only call pay. "}
          <span className="text-neutral-muted">{"Ask for more than today's cap and the contract itself refuses, on chain."}</span>
        </p>
      </header>
      <DemoApp />
      <div className="page-section">
        <PasteCheckPanel />
      </div>
      <SiteFooter />
    </main>
  );
}
