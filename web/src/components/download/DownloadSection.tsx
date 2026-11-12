import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { SectionDot, SectionHeading } from "@/components/ui/SectionHeading";
import { APK_URL } from "@/lib/content";
import { StoreBadges } from "./StoreBadges";

/** 07 — get the app: the Android APK today, the App Store later, or try it in the browser. */
export function DownloadSection() {
  return (
    <div className="pt-64 lg:pt-180 pb-80 lg:pb-204 px-24" id="download">
      <SectionHeading index={7}>Get Lunar</SectionHeading>
      <SectionDot />
      <div className="text-neutral-loud text-titles-h3 text-center max-w-360 lg:max-w-[800px] mx-auto mb-44 lg:mb-64">
        {"Lunar is on Android today. "}<br className="lg-max:hidden" />{"Install the APK, switch keyboards, "}<br className="lg-max:hidden" />{"and pay by name from any chat."}
      </div>
      <div className="flex-center flex-col gap-16">
        <a className="contents" download href={APK_URL}>
          <Button size="large">Download APK</Button>
        </a>
        <StoreBadges />
        <Link className="text-body-x-small text-neutral-faint underline underline-offset-2 hover:text-neutral-loud" href="/demo">
          No Android phone? Try it in your browser
        </Link>
      </div>
    </div>
  );
}
