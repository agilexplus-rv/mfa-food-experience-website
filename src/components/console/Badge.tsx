import { type ReactNode } from 'react'

export const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-matte-gold/20 text-matte-gold',
  confirmed: 'bg-lunar-green/20 text-lunar-green',
  cancelled: 'bg-terracotta/20 text-[#9C4E2F]',
  checked_in: 'bg-lunar-green/20 text-lunar-green',
  scheduled: 'bg-lunar-green/20 text-lunar-green',
  completed: 'bg-lunar-green/20 text-lunar-green',
  none: 'bg-gray-100 text-gray-600',
  succeeded: 'bg-lunar-green/20 text-lunar-green',
  failed: 'bg-terracotta/20 text-[#9C4E2F]',
  waiting: 'bg-matte-gold/20 text-matte-gold',
  notified: 'bg-lunar-green/20 text-lunar-green',
  expired: 'bg-gray-100 text-gray-600',
  admin: 'bg-terracotta/20 text-[#9C4E2F]',
  door_staff: 'bg-lunar-green/20 text-lunar-green',
  active: 'bg-lunar-green/20 text-lunar-green',
  deactivated: 'bg-terracotta/20 text-[#9C4E2F]',
}

interface BadgeProps {
  children: ReactNode
  variant?: string
  className?: string
}

export default function Badge({ children, variant, className = '' }: BadgeProps) {
  const colorClass = variant
    ? (STATUS_COLORS[variant] || 'bg-gray-100 text-gray-600')
    : 'bg-gray-100 text-gray-600'

  return (
    <span
      className={['inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold', colorClass, className].join(' ')}
    >
      {children}
    </span>
  )
}
