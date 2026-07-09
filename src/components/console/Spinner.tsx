interface SpinnerProps {
  label?: string
  className?: string
}

export default function Spinner({ label = 'Loading...', className = '' }: SpinnerProps) {
  return (
    <div className={['text-center py-16 text-text-light', className].join(' ')}>
      <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-lunar-green border-t-transparent" />
      {label}
    </div>
  )
}
