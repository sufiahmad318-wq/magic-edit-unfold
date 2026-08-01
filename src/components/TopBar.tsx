import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useNavigate } from '@/lib/router-compat'

export function TopBar({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string
  subtitle?: string
  onBack?: boolean
  right?: ReactNode
}) {
  const navigate = useNavigate()
  return (
    <header className="sticky top-0 z-30 pt-[env(safe-area-inset-top)] bg-gradient-to-b from-[#0a0a12] via-[#0a0a12]/95 to-transparent">
      <div className="flex items-center gap-3 px-5 pt-5 pb-4">
        {onBack && (
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 shrink-0 rounded-xl glass flex items-center justify-center text-white/80 active:scale-95 transition-transform"
          >
            <ChevronLeft size={18} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="font-display font-semibold text-lg leading-tight truncate">{title}</h1>
          {subtitle && <p className="text-xs text-white/45 mt-0.5 truncate">{subtitle}</p>}
        </div>
        {right}
      </div>
    </header>
  )
}
