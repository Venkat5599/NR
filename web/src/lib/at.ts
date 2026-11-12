/** The item at `index`, throwing when the list is shorter than expected. */
export function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new RangeError(`no item at index ${index}`);
  return item;
}
