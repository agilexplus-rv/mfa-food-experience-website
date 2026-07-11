'use client'

import { type ReactNode } from 'react'

const variantClasses = {
  primary:
    'bg-lunar-green text-soft-beige hover:bg-[color-mix(in_srgb,#33483D_85%,transparent)] focus-visible:ring-lunar-green',
  secondary:
    'border-2 border-lunar-green text-lunar-green hover:bg-lunar-green hover:text-soft-beige focus-visible:ring-lunar-green',
  danger:
    'border-2 border-terracotta text-[#9C4E2F] hover:bg-terracotta hover:text-white focus-visible:ring-terracotta',
} as const

const sizeClasses = {
  // Fixed heights (not padding-derived) so buttons align exactly with
  // the h-10 FilterBar controls on toolbar rows (Rudie 2026-07-12:
  // "consistency in height, clean designs"). md = h-10 matches
  // FilterInput/FilterSelect/FilterDate; sm/lg scale proportionally.
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
} as const

interface ButtonProps {
  children: ReactNode
  variant?: keyof typeof variantClasses
  size?: keyof typeof sizeClasses
  disabled?: boolean
  loading?: boolean
  onClick?: () => void
  className?: string
  type?: 'button' | 'submit'
  title?: string
  ariaLabel?: string
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  className = '',
  type = 'button',
  title,
  ariaLabel,
}: ButtonProps) {
  const isDisabled = disabled || loading

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      title={title}
      aria-label={ariaLabel}
      className={[
        'inline-flex items-center justify-center rounded-lg font-bold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:opacity-40',
        variantClasses[variant],
        sizeClasses[size],
        className,
      ].join(' ')}
    >
      {loading && (
        <span className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  )
}
