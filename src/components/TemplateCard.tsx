import { Heart } from 'lucide-react'
import type { Template } from '../types'
import { isTemplateFavorited, toggleFavoriteTemplate } from '../lib/templateStorage'
import { useState } from 'react'
import clsx from 'clsx'

interface Props {
  template: Template
  onClick: (t: Template) => void
  compact?: boolean
}

export function TemplateCard({ template, onClick, compact = false }: Props) {
  const [fav, setFav] = useState(() => isTemplateFavorited(template.id))

  const handleFav = (e: React.MouseEvent) => {
    e.stopPropagation()
    setFav(toggleFavoriteTemplate(template.id))
  }

  const ratio = template.height / template.width
  const aspectClass = ratio > 1.4
    ? 'aspect-[3/4]'
    : ratio < 0.7
    ? 'aspect-[16/9]'
    : 'aspect-square'

  return (
    <button
      onClick={() => onClick(template)}
      className="group relative w-full text-left active:scale-[0.97] transition-transform duration-150"
    >
      {/* Preview card */}
      <div
        className={clsx(
          'relative w-full rounded-2xl overflow-hidden',
          compact ? 'h-24' : aspectClass,
        )}
      >
        {/* Gradient background */}
        <div className={`absolute inset-0 bg-gradient-to-br ${template.gradient}`} />

        {/* Subtle grid overlay */}
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,.3) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.3) 1px,transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />

        {/* Dimension badge */}
        <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-lg bg-black/40 backdrop-blur-sm text-[10px] text-white/80 font-medium">
          {template.width}×{template.height}
        </div>

        {/* Premium badge */}
        {template.isPremium && (
          <div className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 text-[10px] text-black font-bold">
            PRO
          </div>
        )}

        {/* Fav button */}
        <button
          onClick={handleFav}
          className="absolute top-2 right-2 w-7 h-7 rounded-xl bg-black/30 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity"
        >
          <Heart
            size={13}
            className={clsx(fav ? 'fill-rose-400 stroke-rose-400' : 'stroke-white/80')}
          />
        </button>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors" />
      </div>

      {/* Label */}
      {!compact && (
        <div className="mt-2 px-0.5">
          <p className="text-sm font-medium leading-tight truncate">{template.name}</p>
          <p className="text-[11px] text-white/45 mt-0.5 truncate">{template.description}</p>
        </div>
      )}
    </button>
  )
}
