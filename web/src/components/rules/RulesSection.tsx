import { SectionDot, SectionHeading, SectionImage } from "@/components/ui/SectionHeading";
import { RULE_ROWS } from "@/lib/content";
import { TitleEditor } from "./editor/TitleEditor";
import { RuleTile } from "./RuleTile";
import { VaultApp } from "./VaultApp";

/** 02 — the checks every payment passes. */
export function RulesSection() {
  return (
    <div className="relative pt-40 lg:pt-58 px-8 pb-80 lg:pb-200 overflow-x-clip" id="rules">
      <SectionImage src="/assets/rules/section.webp" />
      <SectionHeading index={2}>Checks a scammer can&apos;t skip</SectionHeading>
      <SectionDot />
      <div className="text-neutral-loud text-titles-h3 text-center max-w-360 lg:max-w-[800px] mx-auto lg-max:mb-32">
        {"Every payment passes "}<br className="lg:hidden" />{" the same checks, "}<br className="lg-max:hidden" />{"so a typo, a lookalike or a lost phone "}
        <TitleEditor text="costs nothing." />
      </div>
      <div className="flex flex-wrap lg:gap-16 max-w-[1208px] mx-auto justify-center mb-24 lg:mb-44 rules-grid">
        {RULE_ROWS.map((row, rowIndex) => (
          <div className="contents" key={rowIndex}>
            <div className="contents">
              {row.map((id) => (
                <RuleTile id={id} key={id} mobileOnly={false} />
              ))}
              {row.map((id) => (
                <RuleTile id={id} key={`${id}-mobile`} mobileOnly />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="text-body-regular text-neutral-faint-2 text-center mb-44 lg:mb-96">and more...</div>
      <div className="text-body-large text-neutral-loud text-center md-max:max-w-340 md-max:mx-auto">
        {"Exchanges charge $200 to $500 "}<br />{"to recover a wrong-network deposit, "}<br className="md-max:hidden" />{"when they can recover it at all."}
      </div>
      <div className="size-1 lg:size-2 bg-neutral-faint-2 my-8 lg:my-44 mx-auto" />
      <div className="text-body-large text-neutral-loud text-center mb-44 md-max:max-w-340 md-max:mx-auto">
        {"Banks have checked payee names for years. "}<br className="md-max:hidden" />{"Crypto still sends to whatever you paste."}
      </div>
      <VaultApp />
      <div className="text-body-large text-neutral-loud text-center mt-12 lg-max:max-w-340 lg-max:mx-auto">
        {"Lunar is designed to check it at the keyboard, "}<br className="lg-max:hidden" />{"enforced by a NEAR contract and NEAR's MPC signers."}<br /><br />{"No support ticket. No company in the middle."}
      </div>
    </div>
  );
}
