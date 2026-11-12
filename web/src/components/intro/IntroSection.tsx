import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { IntroCanvas } from "./IntroCanvas";

/** 01 — what Lunar is. */
export function IntroSection() {
  return (
    <div className="relative pt-224 px-32 pb-72 lg:pb-192 -mt-864 md:-mt-764 lg:-mt-620 z-[10]">
      <IntroCanvas />
      <div className="text-titles-h2 max-w-380 lg:max-w-800 mx-auto mb-24 lg:mb-56">
        <div className="text-[12px]/[12px] font-mono size-32 flex-center -mt-32 -ml-32 text-neutral-faint-3">{"0"}{1}</div>{"Lunar is an "}<br className="lg:hidden" />{" AI keyboard "}<br />{" "}<div className="contents text-neutral-muted">{"that won't let you send money "}<br className="lg:hidden" />{" to the wrong place."}</div>
      </div>
      <div className="flex gap-16 max-w-380 lg:max-w-[1004px] mx-auto mb-24 lg:mb-56">
        <div className="w-188 h-232 intro-dither relative lg-max:hidden opacity-0 translate-y-16 blur-[4px] transition-all duration-[650ms]">
          <Image alt="Lunar" height={232} src="/assets/intro/logo.avif" width={188} />
        </div>
        <div className="flex-1 text-body-x-large">
          <div className="mb-24 lg:mb-40">
            {"Type “pay bob.near 20” in any chat "}<br className="lg:hidden" />{" and Bob gets USDC on the chain he chose. "}<br className="lg:hidden" />{"You never paste an address "}<br className="lg:hidden" />{" or pick a network, "}<br />{"and the keyboard holds one NEAR key. "}<br className="lg:hidden" />{" "}<div className="contents text-neutral-muted">{"It can pay small amounts and "}<br className="lg:hidden" />{" nothing else."}</div>
          </div>
          <div>
            {"Pasted addresses are checked for lookalikes before you sign. "}<br />{"Money sent on the wrong network comes back on its own. "}<br className="lg-max:hidden" /><div className="contents text-neutral-muted">{"Anything over your daily cap "}<br className="lg:hidden" />{" opens your own wallet."}</div>
          </div>
        </div>
      </div>
      <div className="text-body-x-large max-w-380 lg:max-w-800 mx-auto">
        {"Like a bank checking the payee's name, "}<br className="lg:hidden" />{" the goal is simple: make mistakes stop costing money, "}<br /><div className="text-neutral-muted contents">{"shrinking what one wrong tap can lose "}<br className="lg:hidden" />{" from "}<div className="text-gradient inline-block" style={{ background: "linear-gradient(180deg, #1B1B1B 23.44%, #929292 57.81%, #1B1B1B 57.81%, #626262 71.69%, #939393 85.94%)" }}>{"everything"}</div>{" to "}<div className="text-gradient inline-block" style={{ background: "linear-gradient(180deg, #8E6A43 27.11%, #D2AF84 42.71%, #CAB098 58.31%, #9F714B 58.31%, #C49C75 74.47%, #B2834F 90.63%)" }}>{"nothing"}</div>{"."}</div>
      </div>
      <div className="try-cta">
        <Link className="contents" href="/demo">
          <Button size="large">{"Try it in your browser"}</Button>
        </Link>
      </div>
    </div>
  );
}
