"use client";

import { useRef } from "react";
import { FormatToggle } from "./FormatToggle";
import { BoldIcon, ItalicIcon, UnderlineIcon } from "./icons";
import { StylePicker } from "./StylePicker";
import { TurnIntoPicker } from "./TurnIntoPicker";

const TOOLBAR_SHADOW =
  "0px 24px 12px -5px rgba(0, 0, 0, 0.02), 0px 12px 12px -5px rgba(0, 0, 0, 0.04), 0px 3px 3px -1.5px rgba(0, 0, 0, 0.02), 0px 2px 2px -1px rgba(0, 0, 0, 0.02), 0px 0.5px 0.5px 0px rgba(0, 0, 0, 0.04), 0px 0px 0px 0.75px rgba(0, 0, 0, 0.06)";

function Divider() {
  return (
    <div className="py-6 px-3">
      <div className="w-1 h-16 bg-neutral-faint-6 rounded-full" />
    </div>
  );
}

/** "costs nothing." as an editable-looking line with a working formatting toolbar under it. */
export function TitleEditor({ text }: { text: string }) {
  const line = useRef<HTMLDivElement>(null);
  return (
    <div className="mb-32 lg:mb-52 lg-max:contents relative z-[10]">
      <div className="lg:bg-neutral-faint-6 rounded-12 px-10 w-max mx-auto lg:mb-12 relative lg-max:contents" data-text={text} ref={line}>
        {text}
      </div>
      <div className="w-392 mx-auto flex justify-end pr-9 lg-max:hidden">
        <div className="flex gap-4 items-center bg-white rounded-10 p-4 w-max" style={{ boxShadow: TOOLBAR_SHADOW }}>
          <TurnIntoPicker target={line} />
          <Divider />
          <FormatToggle label="Bold" onToggle={(active) => line.current?.classList.toggle("font-[500]", active)}>
            <BoldIcon />
          </FormatToggle>
          <FormatToggle label="Italic" onToggle={(active) => line.current?.classList.toggle("italic", active)}>
            <ItalicIcon />
          </FormatToggle>
          <FormatToggle label="Underline" onToggle={(active) => line.current?.classList.toggle("underline", active)}>
            <UnderlineIcon />
          </FormatToggle>
          <Divider />
          <StylePicker target={line} />
        </div>
      </div>
    </div>
  );
}
