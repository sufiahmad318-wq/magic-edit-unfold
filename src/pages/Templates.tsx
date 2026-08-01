import { useState, useMemo, useRef } from 'react'
import { Search, X, Download, ChevronRight, Heart, Sparkles } from 'lucide-react'
import { useNavigate } from '@/lib/router-compat'
import { TopBar } from '../components/TopBar'
import { TemplateCard } from '../components/TemplateCard'
import { UploadDropzone } from '../components/UploadDropzone'
import { TEMPLATES, TEMPLATE_CATEGORIES, TEMPLATE_PACKS } from '../lib/templateData'
import {
  getFavoriteTemplates,
  getRecentTemplates,
  addRecentTemplate,
  markPackDownloaded,
  isPackDownloaded,
} from '../lib/templateStorage'
import { createProjectFromTemplate } from '../lib/projectActions'
import type { Template } from '../types'

export function Templates() {
  const navigate = useNavigate()
  const [query,     setQuery]     = useState('')
  const [activecat, setActivecat] = useState<string>('all')
  const [selected,  setSelected]  = useState<Template | null>(null)
  const [busy,      setBusy]      = useState(false)
  const [packDl,    setPackDl]    = useState<Record<string, boolean>>({})
  const fileRef = useRef<HTMLInputElement>(null)

  const favorites = useMemo(() => {
    const ids = getFavoriteTemplates()
    return TEMPLATES.filter((t) => ids.includes(t.id))
  }, [])

  const recents = useMemo(() => {
    const ids = getRecentTemplates()
    return ids.map((id) => TEMPLATES.find((t) => t.id === id)).filter(Boolean) as Template[]
  }, [])

  const filtered = useMemo(() => {
    let list = TEMPLATES
    if (activecat !== 'all') list = list.filter((t) => t.category === activecat)
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.includes(q)),
      )
    }
    return list
  }, [activecat, query])

  const handleSelect = (t: Template) => {
    setSelected(t)
    addRecentTemplate(t.id)
  }

  const handleBlank = async () => {
    if (!selected || busy) return
    setBusy(true)
    try {
      const project = await createProjectFromTemplate(selected, null)
      navigate(`/editor/${project.id}`)
    } finally {
      setBusy(false)
      setSelected(null)
    }
  }

  const handleUploadFile = async (file: File) => {
    if (!selected || busy) return
    setBusy(true)
    try {
      const project = await createProjectFromTemplate(selected, file)
      navigate(`/editor/${project.id}`)
    } finally {
      setBusy(false)
      setSelected(null)
    }
  }

  const handleDownloadPack = (packId: string) => {
    markPackDownloaded(packId)
    setPackDl((prev) => ({ ...prev, [packId]: true }))
    // Simulate brief "downloading" animation
    setTimeout(() => {
      setPackDl((prev) => ({ ...prev, [packId]: false }))
    }, 1200)
  }

  return (
    <div className="pb-32">
      <TopBar title="Templates" subtitle="Start with a professional design" />

      {/* ── Hero strip ── */}
      <div className="px-5 mb-5">
        <div className="relative overflow-hidden rounded-3xl hero-gradient p-5 animate-fade-up">
          <div className="pointer-events-none absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-6 -left-4 w-24 h-24 rounded-full bg-fuchsia-400/20 blur-xl" />
          <div className="relative flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center shrink-0 text-2xl">
              🎨
            </div>
            <div>
              <h2 className="font-display font-bold text-base">Creative Templates</h2>
              <p className="text-xs text-white/75 mt-0.5">
                {TEMPLATES.length} templates · {TEMPLATE_CATEGORIES.length} categories
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="px-5 mb-4 animate-fade-up delay-1">
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates…"
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

      {/* ── Category pills ── */}
      <div className="pl-5 mb-5 animate-fade-up delay-2">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pr-5">
          <CategoryPill id="all" label="All" emoji="✦" active={activecat === 'all'} onClick={setActivecat} />
          {TEMPLATE_CATEGORIES.map((cat) => (
            <CategoryPill
              key={cat.id}
              id={cat.id}
              label={cat.name}
              emoji={cat.emoji}
              active={activecat === cat.id}
              onClick={setActivecat}
            />
          ))}
        </div>
      </div>

      {/* ── Favorites ── */}
      {favorites.length > 0 && !query && activecat === 'all' && (
        <section className="mb-6 animate-fade-up delay-2">
          <div className="px-5 flex items-center gap-2 mb-3">
            <Heart size={14} className="fill-rose-400 stroke-rose-400" />
            <h3 className="text-sm font-semibold">Favorites</h3>
          </div>
          <div className="pl-5 flex gap-3 overflow-x-auto no-scrollbar pr-5">
            {favorites.map((t) => (
              <div key={t.id} className="shrink-0 w-32">
                <TemplateCard template={t} onClick={handleSelect} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Recently Used ── */}
      {recents.length > 0 && !query && activecat === 'all' && (
        <section className="mb-6 animate-fade-up delay-3">
          <div className="px-5 flex items-center gap-2 mb-3">
            <Sparkles size={14} className="text-violet-400" />
            <h3 className="text-sm font-semibold">Recently Used</h3>
          </div>
          <div className="pl-5 flex gap-3 overflow-x-auto no-scrollbar pr-5">
            {recents.slice(0, 6).map((t) => (
              <div key={t.id} className="shrink-0 w-32">
                <TemplateCard template={t} onClick={handleSelect} compact />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Main grid ── */}
      <section className="px-5 animate-fade-up delay-3">
        {filtered.length === 0 ? (
          <div className="glass rounded-3xl py-12 text-center">
            <p className="text-3xl mb-3">🔍</p>
            <p className="text-sm font-medium">No templates found</p>
            <p className="text-xs text-white/40 mt-1">Try a different search or category</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((t, i) => (
              <div key={t.id} className="animate-fade-up" style={{ animationDelay: `${0.04 + i * 0.03}s` }}>
                <TemplateCard template={t} onClick={handleSelect} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Template Packs ── */}
      {!query && (
        <section className="px-5 mt-8 animate-fade-up delay-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Template Packs</h3>
            <span className="text-xs text-white/40">Free bundles</span>
          </div>
          <div className="space-y-2.5">
            {TEMPLATE_PACKS.map((pack) => {
              const downloaded = isPackDownloaded(pack.id) || !!packDl[pack.id]
              const loading    = !!packDl[pack.id]
              return (
                <div key={pack.id} className="glass rounded-2xl p-4 flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-xl bg-gradient-to-br ${pack.gradient} flex items-center justify-center text-xl shrink-0`}
                  >
                    {pack.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{pack.name}</p>
                    <p className="text-[11px] text-white/45 mt-0.5">{pack.description}</p>
                    <p className="text-[11px] text-violet-400 mt-0.5">
                      {pack.templateIds.length} templates
                    </p>
                  </div>
                  <button
                    onClick={() => !downloaded && handleDownloadPack(pack.id)}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                      downloaded
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-violet-500/20 text-violet-300 hover:bg-violet-500/30'
                    }`}
                  >
                    {loading ? (
                      <span className="w-3 h-3 rounded-full border border-violet-400 border-t-transparent animate-spin" />
                    ) : downloaded ? (
                      '✓ Saved'
                    ) : (
                      <>
                        <Download size={12} /> Get
                      </>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Template detail sheet ── */}
      {selected && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            onClick={() => !busy && setSelected(null)}
          />
          <div className="fixed inset-x-0 bottom-0 z-50 animate-sheet-up">
            <div className="mx-auto max-w-xl sm:max-w-3xl px-4 pb-[calc(env(safe-area-inset-bottom)+20px)]">
              <div className="glass rounded-3xl overflow-hidden">
                {/* Preview banner */}
                <div className={`relative h-36 bg-gradient-to-br ${selected.gradient} flex items-center justify-center`}>
                  <div className="pointer-events-none absolute inset-0 opacity-10"
                    style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.3) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.3) 1px,transparent 1px)', backgroundSize: '20px 20px' }}
                  />
                  <div className="text-center relative">
                    <p className="font-display font-bold text-lg">{selected.name}</p>
                    <p className="text-sm text-white/70 mt-1">
                      {selected.width}×{selected.height}px
                    </p>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    className="absolute top-3 right-3 w-8 h-8 rounded-xl bg-black/30 flex items-center justify-center"
                  >
                    <X size={15} />
                  </button>
                </div>

                <div className="p-5 space-y-3">
                  <p className="text-sm text-white/60">{selected.description}</p>

                  {/* Upload photo for this template */}
                  {busy ? (
                    <div className="glass rounded-2xl py-8 text-center text-sm text-white/50">
                      Creating project…
                    </div>
                  ) : (
                    <>
                      <UploadDropzone onFile={handleUploadFile} />
                      <button
                        onClick={handleBlank}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/5 border border-white/8 text-sm font-medium text-white/70 hover:bg-white/8 active:scale-[0.98] transition-all"
                      >
                        <ChevronRight size={15} />
                        Start with blank canvas
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleUploadFile(e.target.files[0])}
      />
    </div>
  )
}

// ─── Local sub-component ─────────────────────────────────────────────────────

function CategoryPill({
  id, label, emoji, active, onClick,
}: {
  id: string; label: string; emoji: string; active: boolean; onClick: (id: string) => void
}) {
  return (
    <button
      onClick={() => onClick(id)}
      className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-sm font-medium transition-all active:scale-95 ${
        active
          ? 'bg-gradient-to-r from-blue-500 to-violet-500 text-white shadow-lg shadow-violet-500/20'
          : 'glass text-white/60 hover:text-white/90'
      }`}
    >
      <span>{emoji}</span>
      <span>{label}</span>
    </button>
  )
}
