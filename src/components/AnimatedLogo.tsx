import { Wand2 } from 'lucide-react'
import clsx from 'clsx'

export function AnimatedLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dims = size === 'lg' ? 'w-16 h-16' : size === 'sm' ? 'w-9 h-9' : 'w-12 h-12'
  const iconSize = size === 'lg' ? 26 : size === 'sm' ? 16 : 20

  return (
    <div className={clsx('relative shrink-0', dims)}>
      <div className="absolute inset-[-4px] rounded-2xl border border-dashed border-white/15 animate-spin-slow" />
      <div
        className={clsx(
          dims,
          'relative rounded-2xl hero-gradient flex items-center justify-center animate-logo-pulse overflow-hidden',
        )}
      >
        <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/35 to-transparent w-1/2" />
        <Wand2 size={iconSize} className="text-white relative z-10" strokeWidth={2.25} />
      </div>
    </div>
  )
}
