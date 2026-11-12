"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { waitUntilReady } from "@/components/pixi/scene";

export type HeaderState = { isHome: boolean; isScrolled: boolean; isReady: boolean };

const HeaderContext = createContext<HeaderState>({ isHome: false, isScrolled: false, isReady: true });

export const useHeaderState = () => useContext(HeaderContext);

const READY_DELAY_MS = 1000;

/**
 * Tracks whether the header sits over the home hero (`isHome && !isScrolled`) and whether the
 * hero has finished appearing, so header pieces can fade in after it.
 */
export function HeaderStateProvider({ children }: { children: ReactNode }) {
  const isHome = usePathname() === "/";
  const [isReady, setIsReady] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const hero = document.querySelector<HTMLCanvasElement>(".hero-pixi");
    let readyTimer = 0;
    let active = true;
    if (hero) {
      void waitUntilReady(hero).then(() => {
        if (active) readyTimer = window.setTimeout(() => setIsReady(true), READY_DELAY_MS);
      });
    } else setIsReady(true);
    const onScroll = () => {
      const threshold = isHome && hero ? hero.clientHeight + (window.innerWidth < 968 ? -600 : -200) : 50;
      setIsScrolled(window.scrollY > threshold);
    };
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => {
      active = false;
      clearTimeout(readyTimer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [isHome]);

  return <HeaderContext.Provider value={{ isHome, isScrolled, isReady }}>{children}</HeaderContext.Provider>;
}
