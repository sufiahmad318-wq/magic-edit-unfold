import type { AssetItem } from '../types'

interface Props {
  asset: AssetItem
  onClick: (a: AssetItem) => void
}

export function AssetCard({ asset, onClick }: Props) {
  return (
    <button
      onClick={() => onClick(asset)}
      className="group relative w-full text-left active:scale-[0.96] transition-transform duration-150"
    >
      {/* Preview tile */}
      <div
        className={`relative aspect-square w-full rounded-2xl overflow-hidden bg-gradient-to-br ${asset.gradient} flex items-center justify-center`}
      >
        {/* SVG sticker / shape */}
        {(asset.category === 'stickers' || asset.category === 'shapes' || asset.category === 'frames') && asset.svgPath && (
          <svg
            viewBox={asset.svgViewBox ?? '0 0 24 24'}
            className="w-1/2 h-1/2 fill-white drop-shadow-lg"
            aria-hidden
          >
            <path d={asset.svgPath} fillRule="evenodd" />
          </svg>
        )}

        {/* Overlay preview */}
        {asset.category === 'overlays' && (
          <div className="absolute inset-0 rounded-2xl" style={{ background: asset.cssGradient }} />
        )}

        {/* Text effect preview */}
        {asset.category === 'text-effects' && (
          <span
            className="text-xl font-display font-bold text-white select-none"
            style={{ textShadow: asset.textShadow }}
          >
            {asset.sampleText ?? 'Aa'}
          </span>
        )}

        {/* Font preview */}
        {asset.category === 'fonts' && (
          <span
            className="text-lg font-bold text-white select-none"
            style={{ fontFamily: asset.fontFamily }}
          >
            {asset.sampleText ?? 'Aa'}
          </span>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors rounded-2xl" />
      </div>

      {/* Name */}
      <p className="mt-1.5 text-xs text-white/60 text-center truncate px-1">{asset.name}</p>
    </button>
  )
}
