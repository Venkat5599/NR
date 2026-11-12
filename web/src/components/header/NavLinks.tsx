"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { memo } from "react";
import { Button } from "@/components/ui/Button";
import { NAV_LINKS } from "@/lib/content";
import { useMediaQuery } from "@/lib/use-media-query";
import { useHeaderState } from "./header-state";
import { MobileMenu } from "./MobileMenu";

const SPRING = { type: "spring", stiffness: 60, damping: 10, filter: { ease: "easeInOut", duration: 0.4 } } as const;

/** Section links shown once scrolled; links to the current page collapse away. */
export const NavLinks = memo(function NavLinks() {
  const { isReady } = useHeaderState();
  const pathname = usePathname();
  const phone = useMediaQuery("(max-width: 568px)");
  if (phone) return <MobileMenu />;
  return (
    <div className="flex -mx-6">
      {NAV_LINKS.map((link, index) => {
        const shown = link.href === "/" ? pathname !== "/" : !pathname.startsWith(link.href);
        return (
          <motion.div
            animate={shown ? { width: "auto", opacity: 1, margin: "0 6px", y: 0 } : { width: 0, opacity: 0, margin: 0, y: 0 }}
            className="flex-center"
            key={link.href}
            transition={{ type: "spring", stiffness: 180, damping: 20 }}
          >
            <Link className="contents" href={link.href}>
              <Button
                animate={
                  isReady && shown
                    ? { opacity: 1, y: 0, filter: "blur(0px)", transition: { ...SPRING, delay: (NAV_LINKS.length - index) * 0.1 } }
                    : { opacity: 0, y: -10, filter: "blur(4px)" }
                }
                exit={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                initial={{ opacity: 0, y: -10, filter: "blur(4px)" }}
                transition={{ ...SPRING, delay: 0.1 * index }}
                variant="secondary"
              >
                {link.label}
              </Button>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
});
