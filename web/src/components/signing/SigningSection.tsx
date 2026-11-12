import { SectionDot, SectionHeading, SectionImage } from "@/components/ui/SectionHeading";
import { SETTLEMENT_CHAINS } from "@/lib/content";

/** 03 — how a payment by name lands on the receiver's chain. */
export function SigningSection() {
  return (
    <div className="relative pb-80 lg:pb-200 pt-40 px-24 overflow-x-clip">
      <SectionImage src="/assets/signing/section.webp" />
      <SectionHeading index={3}>How it lands</SectionHeading>
      <SectionDot />
      <div className="text-neutral-loud text-titles-h3 text-center max-w-360 lg:max-w-[800px] mx-auto">
        {"You pay a name, not an address, "}<br />{"and NEAR settles it on the chain they chose."}
      </div>
      <div className="my-44 lg:my-64 flex flex-wrap justify-center gap-12 lg:gap-32 max-w-596 mx-auto">
        {SETTLEMENT_CHAINS.map((chain) => (
          <div className="text-neutral-loud text-body-large px-32 py-18 bg-neutral-faint-6 rounded-full" key={chain}>
            {chain}
          </div>
        ))}
      </div>
      <div className="text-neutral-loud text-titles-h3 text-center max-w-360 lg:max-w-[800px] mx-auto">
        {"Money on the wrong chain is proven by NEAR's signers, "}<br className="lg-max:hidden" />{"then forwarded to the receiver or refunded."}<br /><br />{"No pasted addresses. No lost transfers."}
      </div>
    </div>
  );
}
