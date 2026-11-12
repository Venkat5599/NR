import { EVIDENCE_URL, README_URL, REPO_URL } from "@/lib/content";
import { CopyRepoButton } from "./CopyRepoButton";

const LINKS = [
  { label: "GitHub", href: REPO_URL },
  { label: "Pitch", href: README_URL },
  { label: "Evidence", href: EVIDENCE_URL },
];

export function SiteFooter() {
  return (
    <div className="pt-64 lg:pt-140 pb-80 lg:pb-96">
      <svg className="mb-80 lg:mb-124 mx-auto" fill="none" height="48" viewBox="0 0 48 48" width="48" xmlns="http://www.w3.org/2000/svg">
        <path d="M39.557 30.854A17 17 0 1 1 22.562 7.061A14.62 14.62 0 1 0 39.557 30.854Z" fill="#050505" fillOpacity="0.8" />
      </svg>
      <CopyRepoButton />
      <div className="max-w-596 w-full mx-auto grid xs:grid-cols-3 gap-32 xs:gap-16 mb-80 lg:mb-200">
        {LINKS.map((link) => (
          <a
            className="text-body-large text-neutral-loud text-center !underline decoration-transparent transition-all duration-100 hover:decoration-black/20 underline-offset-2 [text-decoration-thickness:1.5px]"
            href={link.href}
            key={link.label}
            rel="noreferrer"
            target="_blank"
          >
            {link.label}
          </a>
        ))}
      </div>
      <div className="text-body-small text-center text-neutral-faint">Lunar · Safe AI keyboard · MIT © 2026</div>
    </div>
  );
}
