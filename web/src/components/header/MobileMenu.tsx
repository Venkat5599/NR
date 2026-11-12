"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { NAV_LINKS } from "@/lib/content";

const SPRING = { type: "spring", stiffness: 180, damping: 20 } as const;
const BAR_SPRING = { type: "spring", stiffness: 200, damping: 20 } as const;

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg fill="none" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
      <motion.path animate={{ rotate: open ? 45 : 0, y: open ? 5.5 : 0 }} d="M4 7H20" stroke="white" strokeLinecap="round" strokeWidth="1.25" transition={BAR_SPRING} />
      <motion.path animate={{ opacity: open ? 0 : 1, x: open ? -20 : 0 }} d="M4 12H20" stroke="white" strokeLinecap="round" strokeWidth="1.25" transition={BAR_SPRING} />
      <motion.path animate={{ rotate: open ? -45 : 0, y: open ? -4.5 : 0 }} d="M4 17H20" stroke="white" strokeLinecap="round" strokeWidth="1.25" transition={BAR_SPRING} />
    </svg>
  );
}

/** Phone navigation: a burger that opens a full-screen list of numbered links. */
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      <Button className="!p-8" onClick={() => setOpen(!open)} size="medium">
        <MenuIcon open={open} />
      </Button>
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="bg-white !fixed overlay pt-88 flex flex-col z-[12]"
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              transition={{ ...SPRING, delay: 0.1 }}
            >
              <div className="h-1 bg-neutral-faint-5" />
              <div className="py-88 flex-1 flex flex-col gap-48">
                {NAV_LINKS.map((link, index) => (
                  <Link className="contents" href={link.href} key={link.href}>
                    <motion.div
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      className="text-[48px]/[56px] px-48 relative"
                      exit={{ opacity: 0, y: 10, filter: "blur(4px)", transition: { ...SPRING, delay: 0 } }}
                      initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                      transition={{ ...SPRING, delay: 0.1 * index }}
                    >
                      <div className="text-[12px]/[12px] font-mono size-32 flex-center absolute -top-32 left-16 text-neutral-faint-3">
                        {"0"}
                        {index + 1}
                      </div>
                      {link.label}
                    </motion.div>
                  </Link>
                ))}
              </div>
              <div className="pb-40 px-48">
                <Link className="contents" href="/#waitlist">
                  <Button
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    className="w-full !py-14"
                    exit={{ opacity: 0, y: 10, filter: "blur(4px)", transition: { ...SPRING, delay: 0 } }}
                    initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
                    size="medium"
                    transition={{ ...SPRING, delay: 0.3 }}
                  >
                    Join waitlist
                  </Button>
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
