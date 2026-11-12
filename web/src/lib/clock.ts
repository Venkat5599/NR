/** `HH:mm` in the visitor's local time. */
export function formatClock(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Milliseconds until the next whole minute. */
export function msUntilNextMinute(date: Date): number {
  return (60 - date.getSeconds()) * 1000 - date.getMilliseconds();
}
