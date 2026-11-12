import { SectionDot, SectionHeading } from "@/components/ui/SectionHeading";
import { StoreBadges } from "./StoreBadges";
import { WaitlistForm } from "./WaitlistForm";

/** 07 — download or join the waitlist. */
export function WaitlistSection() {
  return (
    <div className="pt-64 lg:pt-180 pb-80 lg:pb-204 px-24" id="waitlist">
      <SectionHeading index={7}>Join the waitlist</SectionHeading>
      <SectionDot />
      <div className="text-neutral-loud text-titles-h3 text-center max-w-360 lg:max-w-[800px] mx-auto mb-44 lg:mb-64">
        {"Lunar is coming to Android first, "}<br className="lg-max:hidden" />{"then the App Store. "}<br />{" "}<br />{"Leave your email and we'll tell you "}<br className="lg-max:hidden" />{"the day it ships."}
      </div>
      <div id="waitlist-form">
        <StoreBadges />
        <WaitlistForm />
      </div>
    </div>
  );
}
