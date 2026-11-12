import { ApproversSection } from "@/components/approvers/ApproversSection";
import { SiteFooter } from "@/components/footer/SiteFooter";
import { GuaranteeSection } from "@/components/guarantee/GuaranteeSection";
import { HeroSection } from "@/components/hero/HeroSection";
import { IntroSection } from "@/components/intro/IntroSection";
import { PageLoader } from "@/components/loader/PageLoader";
import { PartsSection } from "@/components/parts/PartsSection";
import { RulesSection } from "@/components/rules/RulesSection";
import { SigningSection } from "@/components/signing/SigningSection";
import { WaitlistSection } from "@/components/waitlist/WaitlistSection";

export default function HomePage() {
  return (
    <>
      <PageLoader />
      <HeroSection />
      <IntroSection />
      <RulesSection />
      <SigningSection />
      <GuaranteeSection />
      <PartsSection />
      <ApproversSection />
      <WaitlistSection />
      <SiteFooter />
    </>
  );
}
