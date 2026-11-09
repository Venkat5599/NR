import * as React from "react"

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number
}

/** Lunar crescent. */
export function Logo({ size = 24, className, ...props }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} {...props}>
      <path d="M20.5 14.6A8.6 8.6 0 1 1 9.4 3.5a7 7 0 0 0 11.1 11.1z" fill="currentColor" />
    </svg>
  )
}
