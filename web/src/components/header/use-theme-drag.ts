"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { snapProgress } from "@/lib/theme-layers";
import { useThemeProgress } from "@/lib/theme-store";

/**
 * Dragging across `track` sets the time of day (0 morning to 1 night), snapping to named
 * times. `dragPower` is the recent drag speed, used to stretch the dial at its ends.
 */
export function useThemeDrag(track: RefObject<HTMLElement | null>) {
  const [themeProgress, setThemeProgress] = useThemeProgress();
  const [isDragging, setIsDragging] = useState(false);
  const [dragPower, setDragPower] = useState(0);
  const lastX = useRef<number | null>(null);

  const moveTo = useCallback(
    (clientX: number) => {
      if (!track.current) return;
      if (lastX.current !== null) setDragPower((clientX - lastX.current) / 50);
      lastX.current = clientX;
      const rect = track.current.getBoundingClientRect();
      setThemeProgress(snapProgress(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))));
    },
    [track, setThemeProgress],
  );

  const onMouseMove = useCallback((event: MouseEvent) => moveTo(event.clientX), [moveTo]);
  const onTouchMove = useCallback(
    (event: TouchEvent) => {
      const touch = event.touches[0];
      if (touch) moveTo(touch.clientX);
    },
    [moveTo],
  );

  const onMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragPower(0);
    lastX.current = null;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  }, [onMouseMove]);

  const onTouchEnd = useCallback(() => {
    setIsDragging(false);
    setDragPower(0);
    lastX.current = null;
    document.removeEventListener("touchmove", onTouchMove);
    document.removeEventListener("touchend", onTouchEnd);
  }, [onTouchMove]);

  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      setIsDragging(true);
      lastX.current = event.clientX;
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [onMouseMove, onMouseUp],
  );

  const handleTouchStart = useCallback(
    (event: React.TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      setIsDragging(true);
      lastX.current = touch.clientX;
      document.addEventListener("touchmove", onTouchMove);
      document.addEventListener("touchend", onTouchEnd);
    },
    [onTouchMove, onTouchEnd],
  );

  useEffect(
    () => () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    },
    [onMouseMove, onMouseUp, onTouchMove, onTouchEnd],
  );

  return { themeProgress, isDragging, dragPower, handleMouseDown, handleTouchStart };
}
