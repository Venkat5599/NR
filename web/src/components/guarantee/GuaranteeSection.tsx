import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { SectionDot, SectionHeading, SectionImage } from "@/components/ui/SectionHeading";
import { README_URL } from "@/lib/content";
import { RotatingQuote } from "./RotatingQuote";

/** 04 — the guarantee, with rotating one-line promises. */
export function GuaranteeSection() {
  return (
    <div className="relative pb-80 lg:pb-200 pt-40 px-24 overflow-x-clip" id="guarantee">
      <SectionImage src="/assets/guarantee/section.webp" />
      <SectionHeading index={4}>The Lunar Guarantee</SectionHeading>
      <SectionDot />
      <div className="text-neutral-loud text-titles-h3 text-center max-w-360 lg:max-w-[800px] mx-auto">
        {"Whatever you paste, wherever it lands, "}<br className="lg-max:hidden" />{"a mistake from this keyboard costs nothing."}<br /><br />{"And anyone can check every save on the public record, "}<br className="lg-max:hidden" />{"each with its transaction link."}
      </div>
      <RotatingQuote />
      <Link aria-label="Read the Lunar README" className="contents" href={README_URL}>
        <Button className="mx-auto" size="large">
          Read the README
        </Button>
      </Link>
    </div>
  );
}
