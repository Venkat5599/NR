"use client";

import Image from "next/image";
import { PixiCanvas } from "@/components/pixi/PixiCanvas";
import { setupVaultErase } from "./vault-erase";

const SETUPS = [setupVaultErase];

export function VaultApp() {
  return (
    <div className="size-[200px] mx-auto relative vault-app opacity-0 transition">
      <Image alt="Vault app" height={200} src="/assets/rules/app.avif" width={200} />
      <Image
        alt="Vault app"
        className="absolute top-116 cw-270 max-w-[unset]"
        height={200}
        src="/assets/rules/app-reflection.avif"
        width={270}
      />
      <PixiCanvas className="overlay" initOptions={{ backgroundAlpha: 0 }} resolution={2} setups={SETUPS} />
    </div>
  );
}
