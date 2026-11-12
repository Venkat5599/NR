import { useLayoutEffect, useState } from "react";

const matches = (query: string): boolean =>
  typeof window === "undefined" ? false : window.matchMedia(query).matches;

/** Live result of a CSS media query; components using it must render client-side only. */
export function useMediaQuery(query: string): boolean {
  const [value, setValue] = useState(() => matches(query));
  useLayoutEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setValue(list.matches);
    update();
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, [query]);
  return value;
}
