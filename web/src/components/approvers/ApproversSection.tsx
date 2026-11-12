import { SectionHeading } from "@/components/ui/SectionHeading";
import { ApproverPortrait } from "./ApproverPortrait";
import type { ApproverId } from "./scenes";

const APPROVERS: { id: ApproverId; name: string; role: string }[] = [
  { id: "holder", name: "Keyboard", role: "Pay within today's cap" },
  { id: "guardian", name: "Your wallet", role: "Bigger payments and cap changes" },
];

/** 06 — which key approves which payments. */
export function ApproversSection() {
  return (
    <div className="pt-64 lg:pt-200 pb-78 lg:pb-168 px-24 overflow-x-clip">
      <SectionHeading index={6}>Who approves what</SectionHeading>
      <div className="size-3 bg-neutral-faint my-32 mx-auto" />
      <div className="text-neutral-loud text-titles-h3 text-center max-w-[800px] mx-auto mb-56 lg:mb-88">
        {"Two keys, two jobs. "}<br />{"The keyboard can pay "}<br className="lg:hidden" />{"within today's cap. "}<br />{"Your wallet approves the rest."}<br /><br />{"Nobody can raise the cap from the keyboard."}
      </div>
      <div className="grid md:grid-cols-2 gap-80 xl:gap-160 mx-auto max-w-944">
        {APPROVERS.map((approver) => (
          <div className="text-center" key={approver.id}>
            <div className="w-full h-550 relative">
              <div className="cw-392 h-full absolute top-0">
                <ApproverPortrait id={approver.id} />
              </div>
            </div>
            <div className="text-body-large mb-4 text-neutral-loud">{approver.name}</div>
            <div className="text-body-regular text-neutral-faint">{approver.role}</div>
            <div className="w-128 mx-auto my-32 bg-border-light h-1" />
          </div>
        ))}
      </div>
    </div>
  );
}
