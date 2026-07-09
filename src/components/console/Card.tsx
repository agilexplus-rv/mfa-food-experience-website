import { type ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  padding?: boolean
}

export default function Card({ children, className = '', padding = true }: CardProps) {
  return (
    <div className={['rounded-xl border border-border bg-surface', padding ? 'p-6' : '', className].join(' ')}>
      {children}
    </div>
  )
}
