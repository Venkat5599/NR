"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { snapProgress } from "@/lib/theme-layers";
import { useThemeProgress } from "@/lib/theme-store";

/**
 * Dragging across `track` sets the time of day (0 morning to 1 night), snapping to named
 * times. `dragPower` is the recent drag speed, used to stretch the dial at its ends.
 *
 * The document listeners for one drag are created on press and removed on release only.
 * They read the latest setter through a ref, so re-renders mid-drag can't detach them.
 */
export function useThemeDrag(track: RefObject<HTMLElement | null>) {
  const [themeProgress, setThemeProgress] = useThemeProgress();
  const [isDragging, setIsDragging] = useState(false);
  const [dragPower, setDragPower] = useState(0);
  const lastX = useRef<number | null>(null);
  const setProgress = useRef(setThemeProgress);
  const endDrag = useRef<(() => void) | null>(null);

  useEffect(() => {
    setProgress.current = setThemeProgress;
  }, [setThemeProgress]);

  const moveTo = useCallback(
    (clientX: number) => {
      const el = track.current;
      if (!el) return;
      if (lastX.current !== null) setDragPower((clientX - lastX.current) / 50);
      lastX.current = clientX;
      const rect = el.getBoundingClientRect();
      setProgress.current(snapProgress(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))));
    },
    [track],
  );

  const begin = useCallback((clientX: number, detach: () => void) => {
    endDrag.current?.();
    setIsDragging(true);
    lastX.current = clientX;
    endDrag.current = () => {
      detach();
      setIsDragging(false);
      setDragPower(0);
      lastX.current = null;
      endDrag.current = null;
    };
  }, []);

  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      const onMove = (e: MouseEvent) => moveTo(e.clientX);
      const onUp = () => endDrag.current?.();
      begin(event.clientX, () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      });
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [begin, moveTo],
  );

  const handleTouchStart = useCallback(
    (event: React.TouchEvent) => {
      const start = event.touches[0];
      if (!start) return;
      const onMove = (e: TouchEvent) => {
        const point = e.touches[0];
        if (point) moveTo(point.clientX);
      };
      const onEnd = () => endDrag.current?.();
      begin(start.clientX, () => {
        document.removeEventListener("touchmove", onMove);
        document.removeEventListener("touchend", onEnd);
        document.removeEventListener("touchcancel", onEnd);
      });
      document.addEventListener("touchmove", onMove);
      document.addEventListener("touchend", onEnd);
      document.addEventListener("touchcancel", onEnd);
    },
    [begin, moveTo],
  );

  useEffect(() => () => endDrag.current?.(), []);

  return { themeProgress, isDragging, dragPower, handleMouseDown, handleTouchStart };
}
