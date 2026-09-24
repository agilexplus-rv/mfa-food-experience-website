export type LogoVariant = "primary" | "inverted" | "white" | "black"
export type LogoSize = "sm" | "md" | "lg" | "xl"

const logoMap: Record<LogoVariant, string> = {
  primary: "/brand/logos/Malta Food - Primary.svg",
  inverted: "/brand/logos/Malta Food - Inverted.svg",
  white: "/brand/logos/Malta Food - White.svg",
  black: "/brand/logos/Malta Food - Black.svg",
}

const sizeMap: Record<LogoSize, number> = {
  sm: 120,
  md: 180,
  lg: 260,
  xl: 360,
}

export interface LogoProps {
  variant?: LogoVariant
  size?: LogoSize
  className?: string
}

/**
 * MFA logo component.
 *
 * Renders one of 4 colour variants at a named size.
 * SVGs are served from public/brand/logos/ as plain <img> elements
 * (SVGs are vector, resolution-independent; no next/image needed).
 *
 * Applies the clear-space rule: inline padding equal to 30% of the
 * configured width so the logo is never crowded by adjacent elements.
 */
export function Logo({
  variant = "primary",
  size = "md",
  className = "",
}: LogoProps) {
  const width = sizeMap[size]
  const src = logoMap[variant]

  return (
    <img
      src={src}
      alt="Malta Food Experience"
      width={width}
      className={className}
      style={{ padding: `${Math.round(width * 0.3)}px` }}
    />
  )
}
