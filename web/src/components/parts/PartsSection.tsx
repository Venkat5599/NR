import Link from "next/link";
import { Fragment } from "react";
import { Button } from "@/components/ui/Button";
import { SectionDot, SectionHeading, SectionImage } from "@/components/ui/SectionHeading";
import { PARTS, REPO_URL, type Part } from "@/lib/content";
import { PartThumbnail } from "./PartThumbnail";

function PartCard({ part }: { part: Part }) {
  return (
    <div>
      <a
        className="aspect-[596/730] group block relative rounded-10 overflow-hidden before:inside-border before:!z-[10] before:border-neutral-faint-6"
        href={REPO_URL}
      >
        <div className="overlay group-hover:scale-[1.02] transition-all duration-600">
          <PartThumbnail id={part.id} />
        </div>
      </a>
      <div className="pt-20 px-12">
        <div className="text-[18px]/[24px] tracking-[0.36px] text-neutral-loud mb-4">{part.title}</div>
        <div className="text-body-small text-neutral-muted flex gap-8 items-center">
          {part.tags.map((tag, index) => (
            <Fragment key={tag}>
              {index !== 0 && <div className="size-[1.5px] bg-neutral-muted" />}
              <div className="text-body-small text-neutral-muted flex gap-8 items-center">{tag}</div>
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

/** 05 — the four open parts behind the guarantee. */
export function PartsSection() {
  const rows = [PARTS.slice(0, 2), PARTS.slice(2, 4)];
  return (
    <div className="relative pt-40 pb-80 lg:pb-232 px-12 overflow-x-clip" id="parts">
      <SectionImage src="/assets/parts/section.webp" />
      <SectionHeading index={5}>Parts</SectionHeading>
      <SectionDot />
      <div className="text-neutral-loud text-titles-h3 text-center max-w-[800px] mx-auto mb-64">
        {"Four parts, one guarantee, "}<br />{"each of them open to read."}
      </div>
      <Link className="contents" href={REPO_URL}>
        <Button className="mx-auto mb-64 lg:mb-80" size="large">
          Read the spec
        </Button>
      </Link>
      <div className="max-w-400 lg:max-w-[1208px] mx-auto">
        {rows.map((row, index) => (
          <div className={index === 0 ? "grid lg:grid-cols-2 gap-40 lg:gap-16 mb-40 lg:mb-64" : "grid lg:grid-cols-2 gap-40 lg:gap-16"} key={index}>
            {row.map((part) => (
              <PartCard key={part.id} part={part} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
