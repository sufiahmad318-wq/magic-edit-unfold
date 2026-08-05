import clsx from 'clsx'
import { AnimatedLogo } from './AnimatedLogo'

/** Shimmering placeholder block used while data or images resolve. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton rounded-2xl', className)} />
}

/** Grid of project/tool card placeholders. */
export function CardGridSkeleton({
  count = 4,
  aspect = 'aspect-[3/4]',
}: {
  count?: number
  aspect?: string
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className={aspect} />
          <Skeleton className="h-3 w-2/3 rounded-md" />
        </div>
      ))}
    </div>
  )
}

/** Full-screen branded route loader used as the router pending component. */
export function PageLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 px-6 animate-fade-up">
      <AnimatedLogo size="md" />
      <div className="w-40 h-1 rounded-full bg-white/10 overflow-hidden">
        <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-blue-500 to-violet-500 animate-loader-sweep" />
      </div>
      <p className="text-xs text-white/40">{label}…</p>
    </div>
  )
}

/** Inline spinner for buttons and small async regions. */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        'inline-block rounded-full border-2 border-white/25 border-t-white animate-spin',
        className ?? 'w-4 h-4',
      )}
    />
  )
}
