"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";

const HIDE_AFTER_MS = 1000;
const DRAG_CLASSES = ["!bg-black/40", "!w-8", "!right-6"];

function ScrollbarTrack() {
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    const thumb = thumbRef.current;
    if (!track || !thumb) return undefined;
    let visibleShare = 0;
    let hideTimer = 0;
    let dragging = false;
    let dragStartY = 0;
    let dragStartScroll = 0;

    const layout = () => {
      const scrollable = document.body.scrollHeight - window.innerHeight;
      visibleShare = window.innerHeight / document.body.scrollHeight;
      const offset = 8 + (window.scrollY / scrollable) * (window.innerHeight - visibleShare * window.innerHeight - 16);
      thumb.style.height = `${100 * visibleShare}%`;
      thumb.style.transform = `translateY(${offset}px)`;
    };
    const flash = () => {
      if (visibleShare === 1 || window.innerWidth < 1024) return;
      clearTimeout(hideTimer);
      thumb.classList.remove("opacity-0");
      hideTimer = window.setTimeout(() => thumb.classList.add("opacity-0"), HIDE_AFTER_MS);
    };
    const onDrag = (event: MouseEvent) => {
      if (!dragging) return;
      const scrollable = document.body.scrollHeight - window.innerHeight;
      const share = (event.clientY - dragStartY) / (window.innerHeight - visibleShare * window.innerHeight);
      window.scrollTo({ top: dragStartScroll + share * scrollable, behavior: "instant" });
      flash();
    };
    const endDrag = () => {
      dragging = false;
      document.body.style.userSelect = "";
      thumb.classList.remove(...DRAG_CLASSES);
      flash();
    };
    const startDrag = (event: MouseEvent) => {
      dragging = true;
      dragStartY = event.clientY;
      dragStartScroll = window.scrollY;
      document.body.style.userSelect = "none";
      thumb.classList.add(...DRAG_CLASSES);
      flash();
    };
    const onScroll = () => {
      layout();
      flash();
    };

    layout();
    document.addEventListener("mousemove", onDrag);
    document.addEventListener("mouseup", endDrag);
    window.addEventListener("scroll", onScroll, { passive: true });
    thumb.addEventListener("mousedown", startDrag);
    track.addEventListener("mouseenter", flash);
    return () => {
      clearTimeout(hideTimer);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("mousemove", onDrag);
      document.removeEventListener("mouseup", endDrag);
      thumb.removeEventListener("mousedown", startDrag);
      track.removeEventListener("mouseenter", flash);
    };
  }, []);

  return (
    <div className="fixed right-0 w-16 z-[1000] h-screen top-0" ref={trackRef}>
      <div
        className="bg-black/10 opacity-0 backdrop-blur-4 hover:w-6 w-4 right-8 hover:right-7 transition-[width,right,opacity] duration-[200ms] hover:bg-black/20 absolute top-0 rounded-full"
        ref={thumbRef}
      />
    </div>
  );
}

/** A thin overlay scrollbar that appears while scrolling and can be dragged. */
export const Scrollbar = dynamic(() => Promise.resolve(ScrollbarTrack), { ssr: false });
