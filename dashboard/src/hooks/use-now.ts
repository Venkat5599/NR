import * as React from "react"

/** Current time, refreshed every `ms` so countdowns move. */
export function useNow(ms = 1000) {
  const [now, setNow] = React.useState(() => Date.now())
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}
