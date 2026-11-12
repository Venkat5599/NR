"use client";

import { useEffect, useState } from "react";
import { formatClock, msUntilNextMinute } from "@/lib/clock";

/** The visitor's local time, updated on the minute. */
export function LocalClock() {
  const [time, setTime] = useState(() => formatClock(new Date()));
  useEffect(() => {
    const tick = () => setTime(formatClock(new Date()));
    let interval = 0;
    const alignTimer = window.setTimeout(() => {
      tick();
      interval = window.setInterval(tick, 60000);
    }, msUntilNextMinute(new Date()));
    return () => {
      clearTimeout(alignTimer);
      clearInterval(interval);
    };
  }, []);
  return <>IST {time}</>;
}
