"use client";

import dynamic from "next/dynamic";
import { BrandBar } from "./BrandBar";
import { CenterLogo } from "./CenterLogo";
import { HeaderActions } from "./HeaderActions";
import { HeaderStateProvider } from "./header-state";

function Header() {
  return (
    <HeaderStateProvider>
      <BrandBar />
      <CenterLogo />
      <HeaderActions />
    </HeaderStateProvider>
  );
}

/** The fixed site header; rendered on the client only since it depends on the viewport. */
export const SiteHeader = dynamic(() => Promise.resolve(Header), { ssr: false });
