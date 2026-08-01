import { useState, useMemo } from 'react'
import { Search, X, ChevronRight } from 'lucide-react'
import { useNavigate } from '@/lib/router-compat'
import { TopBar } from '../components/TopBar'
import { AssetCard } from '../components/AssetCard'
import { ASSETS, ASSET_CATEGORIES } from '../lib/assetsData'
import { createProjectFromAsset } from '../lib/projectActions'
import type { AssetItem } from '../types'

export function Assets() {
  const navigate   = useNavigate()
  const [query,    setQuery]    = useState('')
  const [activecat, setActivecat] = useState<string>('stickers')
  const [selected, setSelected] = useState<AssetItem | null>(null)
  const [busy,     setBusy]     = useState(false)

  const filtered = useMemo(() => {
    let list = ASSETS.filter((a) => a.category === activecat)
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.tags.some((t) => t.includes(q)),
      )
    }
    return list
  }, [activecat, query])

  const handleUse = async (size = 800) => {
    if (!selected || busy) return
    setBusy(true)
    try {
      const project = await createProjectFromAsset(selected, size)
      navigate(`/editor/${project.id}`)
    } finally {
      setBusy(false)
      setSelected(null)
    }
  }

  const activeCat = ASSET_CATEGORIES.find((c) => c.id === activecat)

  return (
    <div className="pb-32">
      <TopBar title="Assets" subtitle="Stickers, frames, shapes & more" />

      {/* ── Hero counts row ── */}
      <div className="px-5 mb-4 animate-fade-up">
        <div className="grid grid-cols-3 gap-2">
          {ASSET_CATEGORIES.slice(0, 3).map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActivecat(cat.id)}
              className={`glass rounded-2xl p-3 text-center transition-all active:scale-95 ${
                activecat === cat.id ? 'ring-1 ring-violet-400/50' : ''
              }`}
            >
              <span className="text-xl">{cat.emoji}</span>
              <p className="text-[11px] text-white/60 mt-1">{cat.name}</p>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {ASSET_CATEGORIES.slice(3).map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActivecat(cat.id)}
              className={`glass rounded-2xl p-3 text-center transition-all active:scale-95 ${
                activecat === cat.id ? 'ring-1 ring-violet-400/50' : ''
              }`}
            >
              <span className="text-xl">{cat.emoji}</span>
              <p className="text-[11px] text-white/60 mt-1">{cat.name}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Category pills ── */}
      <div className="pl-5 mb-4 animate-fade-up delay-1">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pr-5">
          {ASSET_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActivecat(cat.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-sm font-medium transition-all active:scale-95 ${
                activecat === cat.id
                  ? `bg-gradient-to-r ${cat.gradient} text-white shadow-md`
                  : 'glass text-white/60 hover:text-white/90'
              }`}
            >
              <span>{cat.emoji}</span>
              <span>{cat.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Search ── */}
      <div className="px-5 mb-4 animate-fade-up delay-2">
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${activeCat?.name ?? 'assets'}…`}
            className="w-full bg-white/5 border border-white/8 rounded-2xl pl-9 pr-9 py-2.5 text-sm outline-none focus:border-violet-400/50 transition-colors"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── Section header ── */}
      <div className="px-5 mb-3 animate-fade-up delay-2">
        <div
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r ${activeCat?.gradient ?? 'from-violet-500 to-blue-500'} bg-opacity-20`}
        >
          <span className="text-sm">{activeCat?.emoji}</span>
          <span className="text-sm font-semibold">{activeCat?.name}</span>
          <span className="text-xs text-white/60 ml-1">{filtered.length}</span>
        </div>
      </div>

      {/* ── Asset Grid ── */}
      <div className="px-5 animate-fade-up delay-3">
        {filtered.length === 0 ? (
          <div className="glass rounded-3xl py-12 text-center">
            <p className="text-3xl mb-3">🔍</p>
            <p className="text-sm font-medium">Nothing found</p>
            <p className="text-xs text-white/40 mt-1">Try a different search</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {filtered.map((a, i) => (
              <div key={a.id} className="animate-fade-up" style={{ animationDelay: `${0.03 + i * 0.025}s` }}>
                <AssetCard asset={a} onClick={setSelected} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Info cards for special categories ── */}
      {(activecat === 'fonts' || activecat === 'text-effects') && (
        <div className="px-5 mt-5 animate-fade-up delay-4">
          <div className="glass rounded-2xl p-4 flex items-start gap-3">
            <span className="text-xl shrink-0">💡</span>
            <p className="text-xs text-white/55 leading-relaxed">
              {activecat === 'fonts'
                ? 'Tap a font to create a sample canvas. You can then use the editor to add your own text on top.'
                : 'Tap a text effect to create a preview canvas. Layer it over your photo in the editor.'}
            </p>
          </div>
        </div>
      )}

      {/* ── Asset detail sheet ── */}
      {selected && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            onClick={() => !busy && setSelected(null)}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 animate-sheet-up">
            <div className="mx-auto max-w-xl sm:max-w-3xl px-4 pb-[calc(env(safe-area-inset-bottom)+20px)]">
              <div className="glass rounded-3xl overflow-hidden">
                {/* Large preview */}
                <div
                  className={`relative h-48 bg-gradient-to-br ${selected.gradient} flex items-center justify-center`}
                >
                  {(selected.category === 'stickers' || selected.category === 'shapes' || selected.category === 'frames') && selected.svgPath && (
                    <svg
                      viewBox={selected.svgViewBox ?? '0 0 24 24'}
                      className="w-28 h-28 fill-white drop-shadow-2xl"
                      aria-hidden
                    >
                      <path d={selected.svgPath} fillRule="evenodd" />
                    </svg>
                  )}
                  {selected.category === 'overlays' && (
                    <div className="absolute inset-0" style={{ background: selected.cssGradient }} />
                  )}
                  {(selected.category === 'text-effects' || selected.category === 'fonts') && (
                    <span
                      className="text-4xl font-display font-bold text-white"
                      style={{
                        textShadow: selected.textShadow,
                        fontFamily: selected.fontFamily,
                      }}
                    >
                      {selected.sampleText ?? 'Aa'}
                    </span>
                  )}
                  <button
                    onClick={() => setSelected(null)}
                    className="absolute top-3 right-3 w-8 h-8 rounded-xl bg-black/30 flex items-center justify-center"
                  >
                    <X size={15} />
                  </button>
                </div>

                <div className="p-5">
                  <p className="font-semibold mb-1">{selected.name}</p>
                  <p className="text-xs text-white/45 mb-4 capitalize">{selected.category.replace('-', ' ')}</p>

                  {busy ? (
                    <div className="glass rounded-2xl py-6 text-center text-sm text-white/50">
                      Creating canvas…
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <button
                        onClick={() => handleUse(800)}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-r from-blue-500 to-violet-500 text-sm font-semibold active:scale-[0.98] transition-transform"
                      >
                        <ChevronRight size={15} />
                        Open in Editor (800×800)
                      </button>
                      <button
                        onClick={() => handleUse(1080)}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl glass text-sm font-medium text-white/70 active:scale-[0.98] transition-transform"
                      >
                        High-res (1080×1080)
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
