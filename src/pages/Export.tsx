import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Check,
  CheckCircle2,
  Clock,
  Download,
  FileImage,
  FileText,
  Image as ImageIcon,
  Loader2,
  Share2,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { TopBar } from '../components/TopBar'
import {
  addExportRecord,
  deleteExportRecord,
  getProject,
  getSettings,
  loadExportRecords,
  loadProjects,
  updateSettings,
} from '../lib/storage'
import { canvasFromImage, canvasThumbnail, loadImage } from '../lib/imageEffects'
import {
  encodeExport,
  FORMAT_META,
  formatBytes,
  resolveExportDimensions,
  RESOLUTION_PRESETS,
  type EncodedExport,
  type ExportOptions,
} from '../lib/exportEngine'
import { canUseFileShare, dataUrlToFile, downloadDataUrl, openDataUrlInNewTab, shareFile } from '../lib/share'
import type { ExportFormat, ExportRecord, Project } from '../types'

const FORMAT_ORDER: { id: ExportFormat; icon: typeof FileImage }[] = [
  { id: 'jpg', icon: ImageIcon },
  { id: 'png', icon: FileImage },
  { id: 'webp', icon: Sparkles },
  { id: 'pdf', icon: FileText },
]

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

const STAGES = ['Preparing image', 'Encoding file', 'Finalizing'] as const

export function Export() {
  const { projectId } = useParams()
  const settings = useMemo(() => getSettings(), [])

  const [project, setProject] = useState<Project | null | undefined>(undefined)
  const [sourceCanvas, setSourceCanvas] = useState<HTMLCanvasElement | null>(null)

  const [format, setFormat] = useState<ExportFormat>(settings.lastExportFormat)
  const [resolutionId, setResolutionId] = useState(settings.lastExportQuality)
  const [compression, setCompression] = useState(settings.lastExportCompression)
  const [transparentBackground, setTransparentBackground] = useState(false)
  const [watermark, setWatermark] = useState(settings.lastWatermark)
  const [fileName, setFileName] = useState('')

  const [estimate, setEstimate] = useState<EncodedExport | null>(null)
  const [estimating, setEstimating] = useState(false)

  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stageIndex, setStageIndex] = useState(0)
  const [result, setResult] = useState<EncodedExport | null>(null)
  const [shareState, setShareState] = useState<'idle' | 'working' | 'done' | 'downloaded'>('idle')
  const [toast, setToast] = useState<string | null>(null)

  const [recentExports, setRecentExports] = useState<ExportRecord[]>(() => loadExportRecords())
  const estimateSeq = useRef(0)

  useEffect(() => {
    let id = projectId
    if (!id || id === 'latest') {
      id = loadProjects()[0]?.id
    }
    const p = id ? (getProject(id) ?? null) : null
    setProject(p)
    if (p) setFileName(p.name)
  }, [projectId])

  useEffect(() => {
    if (!project) return
    let cancelled = false
    loadImage(project.currentData).then((img) => {
      if (!cancelled) setSourceCanvas(canvasFromImage(img))
    })
    return () => {
      cancelled = true
    }
  }, [project])

  useEffect(() => {
    if (format !== 'png') setTransparentBackground(false)
  }, [format])

  const options: ExportOptions = useMemo(
    () => ({ format, resolutionId, compression, transparentBackground, watermark }),
    [format, resolutionId, compression, transparentBackground, watermark],
  )

  // The size "estimate" is a real encode at the chosen settings, debounced so
  // scrubbing the compression slider doesn't thrash the CPU.
  useEffect(() => {
    if (!sourceCanvas) return
    const seq = ++estimateSeq.current
    setEstimating(true)
    const t = setTimeout(() => {
      encodeExport(sourceCanvas, options)
        .then((res) => {
          if (estimateSeq.current === seq) {
            setEstimate(res)
            setEstimating(false)
          }
        })
        .catch(() => {
          if (estimateSeq.current === seq) setEstimating(false)
        })
    }, 220)
    return () => clearTimeout(t)
  }, [sourceCanvas, options])

  const targetDims = sourceCanvas ? resolveExportDimensions(sourceCanvas.width, sourceCanvas.height, resolutionId) : null
  const meta = FORMAT_META[format]

  const runExport = async () => {
    if (!sourceCanvas || !project) return
    setExporting(true)
    setProgress(0)
    setStageIndex(0)

    const tick = (target: number, stage: number, duration: number) =>
      new Promise<void>((resolve) => {
        setStageIndex(stage)
        const start = performance.now()
        const from = progress
        const step = (now: number) => {
          const t = Math.min(1, (now - start) / duration)
          setProgress(from + (target - from) * t)
          if (t < 1) requestAnimationFrame(step)
          else resolve()
        }
        requestAnimationFrame(step)
      })

    await tick(35, 0, 300)
    const encoded = await encodeExport(sourceCanvas, options)
    await tick(80, 1, 260)
    await tick(100, 2, 220)

    updateSettings({
      lastExportFormat: format,
      lastExportQuality: resolutionId,
      lastExportCompression: compression,
      lastWatermark: watermark,
    })

    const thumbnail = canvasThumbnail(sourceCanvas, 160)
    const record: ExportRecord = {
      id: crypto.randomUUID(),
      projectId: project.id,
      projectName: project.name,
      format,
      qualityLabel: RESOLUTION_PRESETS.find((p) => p.id === resolutionId)?.label ?? resolutionId,
      width: encoded.width,
      height: encoded.height,
      sizeBytes: encoded.sizeBytes,
      thumbnail,
      dataUrl: encoded.dataUrl,
      createdAt: Date.now(),
    }
    setRecentExports(addExportRecord(record))

    setExporting(false)
    setResult(encoded)
    setShareState('idle')
  }

  const finalName = () => `${(fileName || project?.name || 'export').trim() || 'export'}.${meta.ext}`

  const handleSaveToGallery = async () => {
    if (!result) return
    setShareState('working')
    const file = dataUrlToFile(result.dataUrl, finalName(), result.mime)
    if (canUseFileShare(file)) {
      const outcome = await shareFile(file, project?.name || 'Magic Edit AI export')
      if (outcome === 'shared') {
        setShareState('done')
        return
      }
      if (outcome === 'cancelled') {
        setShareState('idle')
        return
      }
    }
    downloadDataUrl(result.dataUrl, finalName())
    setShareState('downloaded')
  }

  const handleShare = async () => {
    if (!result) return
    setShareState('working')
    const file = dataUrlToFile(result.dataUrl, finalName(), result.mime)
    const outcome = await shareFile(file, project?.name || 'Magic Edit AI export')
    if (outcome === 'shared') {
      setShareState('done')
    } else if (outcome === 'cancelled') {
      setShareState('idle')
    } else {
      setToast('Sharing isn\u2019t supported here \u2014 downloaded instead')
      downloadDataUrl(result.dataUrl, finalName())
      setShareState('downloaded')
    }
  }

  const handleOpen = () => {
    if (!result) return
    openDataUrlInNewTab(result.dataUrl, result.mime, finalName())
  }

  const openRecent = (record: ExportRecord) => {
    if (!record.dataUrl) {
      setToast('This export\u2019s file data was trimmed to save space \u2014 re-export to get it again')
      return
    }
    openDataUrlInNewTab(record.dataUrl, FORMAT_META[record.format].mime, `${record.projectName}.${record.format}`)
  }

  const removeRecent = (id: string) => setRecentExports(deleteExportRecord(id))

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
  }, [toast])

  if (project === undefined) {
    return <div className="pt-24 text-center text-sm text-white/40">Loading…</div>
  }

  if (!project) {
    return (
      <div className="pb-28">
        <TopBar title="Export" subtitle="No project selected" onBack />
        <div className="px-5 mt-6 text-sm text-white/50">
          Open a project from the editor first, then tap Export.
        </div>
      </div>
    )
  }

  return (
    <div className="pb-40">
      <TopBar title="Export" subtitle={project.name} onBack />

      {result ? (
        <div className="px-5 mt-2 animate-fade-up">
          <div className="rounded-3xl glass p-8 flex flex-col items-center text-center relative overflow-hidden">
            <div className="relative w-20 h-20 flex items-center justify-center mb-4">
              <span className="absolute inset-0 rounded-full border-2 border-emerald-400/70 animate-success-ring" />
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center animate-success-pop">
                <CheckCircle2 size={38} className="text-white" strokeWidth={2.2} />
              </div>
            </div>
            <h2 className="font-display text-xl font-bold">Export complete</h2>
            <p className="text-sm text-white/50 mt-1">
              {meta.label} &middot; {result.width}×{result.height} &middot; {formatBytes(result.sizeBytes)}
            </p>

            <div className="grid grid-cols-2 gap-2.5 w-full mt-6">
              <button
                onClick={handleSaveToGallery}
                disabled={shareState === 'working'}
                className="flex flex-col items-center gap-1.5 py-3.5 rounded-2xl bg-gradient-to-r from-blue-500 to-violet-500 text-sm font-medium active:scale-[0.98] transition-transform disabled:opacity-60"
              >
                {shareState === 'working' ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                Save to Gallery
              </button>
              <button
                onClick={handleShare}
                disabled={shareState === 'working'}
                className="flex flex-col items-center gap-1.5 py-3.5 rounded-2xl glass text-sm font-medium active:scale-[0.98] transition-transform disabled:opacity-60"
              >
                <Share2 size={18} /> Share
              </button>
              <button
                onClick={handleOpen}
                className="flex flex-col items-center gap-1.5 py-3.5 rounded-2xl glass text-sm font-medium active:scale-[0.98] transition-transform"
              >
                <FileImage size={18} /> Open file
              </button>
              <button
                onClick={() => setResult(null)}
                className="flex flex-col items-center gap-1.5 py-3.5 rounded-2xl glass text-sm font-medium text-white/70 active:scale-[0.98] transition-transform"
              >
                <Sparkles size={18} /> Export another
              </button>
            </div>
            {(shareState === 'done' || shareState === 'downloaded') && (
              <p className="text-xs text-emerald-400 mt-4">
                {shareState === 'done' ? 'Shared successfully' : 'Saved to your downloads'}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="px-5 mt-2 space-y-4">
          <div className="rounded-2xl overflow-hidden glass p-2 animate-fade-up">
            <div
              className="relative rounded-xl overflow-hidden bg-black/30 h-[26vh] flex items-center justify-center"
              style={{
                backgroundImage:
                  transparentBackground && format === 'png'
                    ? 'repeating-conic-gradient(#1c1c2a 0% 25%, #14141f 0% 50%) 50% / 16px 16px'
                    : undefined,
              }}
            >
              {sourceCanvas && (
                <img src={sourceCanvas.toDataURL()} alt={project.name} className="max-w-full max-h-full object-contain" />
              )}
            </div>
            {targetDims && (
              <div className="flex items-center justify-between px-2 pt-2 pb-1 text-[11px] text-white/45">
                <span>
                  {targetDims.width}×{targetDims.height}px
                </span>
                <span>{estimating ? 'Calculating size…' : estimate ? formatBytes(estimate.sizeBytes) : ''}</span>
              </div>
            )}
          </div>

          <div className="glass rounded-2xl p-4 animate-fade-up space-y-5">
            <div>
              <p className="text-xs text-white/60 mb-2">Format</p>
              <div className="grid grid-cols-4 gap-2">
                {FORMAT_ORDER.map(({ id, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setFormat(id)}
                    className={`flex flex-col items-center gap-1.5 py-2.5 rounded-xl text-xs font-medium transition-all active:scale-95 ${
                      format === id ? 'bg-gradient-to-r from-blue-500 to-violet-500 text-white' : 'glass text-white/60'
                    }`}
                  >
                    <Icon size={16} />
                    {FORMAT_META[id].label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-white/60 mb-2">Quality &amp; resolution</p>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {RESOLUTION_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => setResolutionId(preset.id)}
                    className={`shrink-0 flex flex-col items-start px-3.5 py-2.5 rounded-xl transition-all active:scale-95 ${
                      resolutionId === preset.id ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500' : 'glass'
                    }`}
                  >
                    <span className="text-xs font-semibold">{preset.label}</span>
                    <span className="text-[10px] text-white/50">{preset.sublabel}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className={meta.supportsCompression ? '' : 'opacity-40 pointer-events-none'}>
              <div className="flex justify-between text-xs text-white/60 mb-1.5">
                <span>Compression quality</span>
                <span>{meta.supportsCompression ? `${compression}%` : 'Lossless'}</span>
              </div>
              <input
                type="range"
                min={10}
                max={100}
                value={compression}
                onChange={(e) => setCompression(Number(e.target.value))}
                className="w-full"
              />
              {!meta.supportsCompression && (
                <p className="text-[11px] text-white/35 mt-1">PNG is lossless — quality is always maximum.</p>
              )}
            </div>

            {format === 'png' && (
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-sm font-medium">Transparent background</p>
                  <p className="text-[11px] text-white/40 mt-0.5">Works best after using Background Remover</p>
                </div>
                <span
                  onClick={() => setTransparentBackground((v) => !v)}
                  className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${
                    transparentBackground ? 'bg-violet-500' : 'bg-white/15'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                      transparentBackground ? 'translate-x-[22px]' : 'translate-x-0.5'
                    }`}
                  />
                </span>
              </label>
            )}

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm font-medium">Watermark</p>
                <p className="text-[11px] text-white/40 mt-0.5">Adds a small Magic Edit AI mark</p>
              </div>
              <span
                onClick={() => setWatermark((v) => !v)}
                className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${
                  watermark ? 'bg-violet-500' : 'bg-white/15'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                    watermark ? 'translate-x-[22px]' : 'translate-x-0.5'
                  }`}
                />
              </span>
            </label>

            <div>
              <p className="text-xs text-white/60 mb-1.5">File name</p>
              <div className="flex items-center gap-2 rounded-xl glass px-3 py-2.5">
                <input
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  className="flex-1 min-w-0 bg-transparent text-sm outline-none"
                  placeholder="export"
                />
                <span className="text-xs text-white/40 shrink-0">.{meta.ext}</span>
              </div>
            </div>

            <button
              onClick={runExport}
              disabled={exporting || !sourceCanvas}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-blue-500 via-violet-500 to-fuchsia-500 text-sm font-semibold active:scale-[0.99] transition-transform disabled:opacity-60 animate-cta-glow"
            >
              {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              {exporting ? STAGES[stageIndex] : `Export ${meta.label}`}
            </button>
            {exporting && (
              <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-400 to-violet-400 progress-stripe transition-[width] duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {recentExports.length > 0 && (
        <div className="px-5 mt-5">
          <p className="text-xs text-white/40 mb-2 flex items-center gap-1.5">
            <Clock size={12} /> Recent exports
          </p>
          <div className="space-y-2">
            {recentExports.map((r) => (
              <div key={r.id} className="glass rounded-xl p-2 flex items-center gap-3">
                <button onClick={() => openRecent(r)} className="shrink-0 w-11 h-11 rounded-lg overflow-hidden">
                  <img src={r.thumbnail} className="w-full h-full object-cover" alt={r.projectName} />
                </button>
                <button onClick={() => openRecent(r)} className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium truncate">{r.projectName}</p>
                  <p className="text-[11px] text-white/40">
                    {FORMAT_META[r.format].label} &middot; {r.width}×{r.height} &middot; {formatBytes(r.sizeBytes)} &middot;{' '}
                    {timeAgo(r.createdAt)}
                  </p>
                </button>
                <button
                  onClick={() => removeRecent(r.id)}
                  className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-white/40 active:scale-90 transition-transform"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 px-4 py-2.5 rounded-full bg-black/85 text-xs text-white/90 flex items-center gap-2 animate-toast-in shadow-xl">
          <Check size={13} /> {toast}
          <button onClick={() => setToast(null)} className="ml-1">
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  )
}
