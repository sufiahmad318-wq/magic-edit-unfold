import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  Download,
  RotateCcw,
  Save,
  Sparkles,
  Scissors,
  Eraser,
  Wand,
  Replace,
  Check,
  Undo2,
  Redo2,
  Columns2,
  MoreVertical,
  History as HistoryIcon,
  FolderOutput,
  RotateCw,
  Trash2,
  X,
} from 'lucide-react'
import { TopBar } from '../components/TopBar'
import { UploadDropzone } from '../components/UploadDropzone'
import { AnimatedLogo } from '../components/AnimatedLogo'
import { ToolRail } from '../components/ToolRail'
import { BeforeAfterSlider } from '../components/BeforeAfterSlider'
import { TOOL_ICONS } from '../lib/toolIcons'
import {
  addVersion,
  clearDraft,
  deleteVersion,
  getProject,
  getSettings,
  loadDraft,
  loadProjects,
  restoreVersion,
  saveDraft,
  saveProject,
  saveProjectAs,
  setLastProjectId,
  updateSettings,
  type ProjectDraft,
} from '../lib/storage'
import { createProjectFromFile } from '../lib/projectActions'
import {
  applyEnhance,
  applyFilterPreset,
  autoEnhanceSettings,
  canvasFromImage,
  canvasThumbnail,
  canvasToDataUrl,
  cloneCanvas,
  FILTER_PRESETS,
  inpaint,
  loadImage,
  removeBackground,
  replaceColor,
  type EnhanceSettings,
} from '../lib/imageEffects'
import type { Project, ToolId } from '../types'
import { TOOLS } from '../types'

const REPLACE_COLORS = ['#8b5cf6', '#3b82f6', '#22d3ee', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#f8fafc', '#111827']

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  active,
  primary,
}: {
  icon: typeof Undo2
  label: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
  primary?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all active:scale-95 disabled:opacity-30 disabled:active:scale-100 ${
        primary
          ? 'bg-gradient-to-r from-blue-500 to-violet-500 text-white shadow-lg'
          : active
            ? 'glass text-white'
            : 'glass text-white/60 hover:text-white/90'
      }`}
    >
      <Icon size={14} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

interface HistoryState {
  items: string[]
  index: number
}

export function Editor() {
  const navigate = useNavigate()
  const params = useParams()
  const [searchParams] = useSearchParams()
  const projectId = params.projectId

  const [project, setProject] = useState<Project | null | undefined>(undefined)
  const [tool, setTool] = useState<ToolId>((searchParams.get('tool') as ToolId) || 'enhance')
  const [baseCanvas, setBaseCanvas] = useState<HTMLCanvasElement | null>(null)
  const [previewCanvas, setPreviewCanvas] = useState<HTMLCanvasElement | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(true)
  const [compareMode, setCompareMode] = useState(false)
  const [history, setHistory] = useState<HistoryState>({ items: [], index: -1 })
  const [pendingDraft, setPendingDraft] = useState<ProjectDraft | null>(null)
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(() => getSettings().autoSaveEnabled)
  const [showMore, setShowMore] = useState(false)
  const [showVersions, setShowVersions] = useState(false)
  const [showSaveAs, setShowSaveAs] = useState(false)
  const [saveAsName, setSaveAsName] = useState('')

  const [enhanceSettings, setEnhanceSettings] = useState<EnhanceSettings>({
    brightness: 0,
    contrast: 0,
    saturation: 0,
    sharpen: 0,
  })
  const [tolerance, setTolerance] = useState(35)
  const [brushSize, setBrushSize] = useState(28)
  const [replaceColorHex, setReplaceColorHex] = useState('#8b5cf6')
  const [filterThumb, setFilterThumb] = useState<string | null>(null)
  const [lastAppliedFilter, setLastAppliedFilter] = useState<string | null>(null)
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const displayRef = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)

  // Resolve which project to show.
  useEffect(() => {
    let id = projectId
    if (!id || id === 'latest') {
      const list = loadProjects()
      id = list[0]?.id
    }
    if (!id) {
      setProject(null)
      return
    }
    const p = getProject(id)
    setProject(p ?? null)
    if (p) {
      setLastProjectId(p.id)
      const draft = loadDraft(p.id)
      setPendingDraft(draft && draft.updatedAt > p.updatedAt ? draft : null)
    } else {
      setPendingDraft(null)
    }
  }, [projectId])

  const loadIntoEditor = (dataUrl: string, hist?: HistoryState) => {
    return loadImage(dataUrl).then((img) => {
      const canvas = canvasFromImage(img)
      setBaseCanvas(canvas)
      setPreviewCanvas(cloneCanvas(canvas))
      setHistory(hist ?? { items: [dataUrl], index: 0 })
      const mask = document.createElement('canvas')
      mask.width = canvas.width
      mask.height = canvas.height
      maskCanvasRef.current = mask
      return canvas
    })
  }

  // Load base canvas + reset history whenever we switch to a different project
  // (unless we're waiting on the user to decide about a recovered draft).
  useEffect(() => {
    if (!project || pendingDraft) return
    let cancelled = false
    loadIntoEditor(project.currentData).then(() => {
      if (cancelled) return
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, pendingDraft])

  const handleRestoreDraft = () => {
    if (!pendingDraft || !project) return
    loadIntoEditor(pendingDraft.dataUrl, { items: pendingDraft.historyItems, index: pendingDraft.historyIndex }).then(
      () => {
        setTool(pendingDraft.tool)
        setSaved(false)
        setPendingDraft(null)
      },
    )
  }

  const handleDiscardDraft = () => {
    if (!project) return
    clearDraft(project.id)
    setPendingDraft(null)
    loadIntoEditor(project.currentData)
  }

  // Draw preview to the visible canvas, letterboxed.
  useEffect(() => {
    const display = displayRef.current
    const canvas = previewCanvas
    if (!display || !canvas) return
    display.width = canvas.width
    display.height = canvas.height
    const ctx = display.getContext('2d')!
    ctx.clearRect(0, 0, display.width, display.height)
    ctx.fillStyle = '#14141f'
    if (tool === 'background-remover') {
      const tile = 16
      for (let y = 0; y < display.height; y += tile) {
        for (let x = 0; x < display.width; x += tile) {
          ctx.fillStyle = (x / tile + y / tile) % 2 === 0 ? '#1c1c2a' : '#14141f'
          ctx.fillRect(x, y, tile, tile)
        }
      }
    }
    ctx.drawImage(canvas, 0, 0)
  }, [previewCanvas, tool])

  // Live enhance preview as sliders move.
  useEffect(() => {
    if (!baseCanvas || tool !== 'enhance') return
    setPreviewCanvas(applyEnhance(baseCanvas, enhanceSettings))
  }, [baseCanvas, enhanceSettings, tool])

  // Reset per-tool scratch state whenever the active tool or base image changes.
  useEffect(() => {
    if (!baseCanvas) return
    if (tool === 'object-remover' || tool === 'magic-eraser' || tool === 'ai-replace') {
      clearMask()
    }
    if (tool === 'enhance') {
      setEnhanceSettings({ brightness: 0, contrast: 0, saturation: 0, sharpen: 0 })
    } else {
      setPreviewCanvas(cloneCanvas(baseCanvas))
    }
    if (tool === 'ai-filters') {
      setFilterThumb(canvasThumbnail(baseCanvas))
      setLastAppliedFilter(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseCanvas, tool])

  const activeMeta = useMemo(() => TOOLS.find((t) => t.id === tool)!, [tool])

  const handleReplace = async (file: File) => {
    const newProject = await createProjectFromFile(file)
    navigate(`/editor/${newProject.id}?tool=${tool}`, { replace: true })
  }

  const persist = (dataUrl: string) => {
    if (!project) return
    const updated: Project = { ...project, currentData: dataUrl, lastTool: tool, updatedAt: Date.now() }
    saveProject(updated)
    setProject(updated)
    setSaved(true)
    clearDraft(project.id)
  }

  const commitSave = (label: string) => {
    if (!baseCanvas || !project) return
    const dataUrl = canvasToDataUrl(baseCanvas)
    persist(dataUrl)
    addVersion(project.id, dataUrl, label)
  }

  // Persist an unsaved-edit draft shortly after each commit, so work survives an
  // app restart even if the user never taps Save. Distinct from the Save/version system.
  useEffect(() => {
    if (!project || !baseCanvas || saved || pendingDraft) return
    const t = setTimeout(() => {
      saveDraft(project.id, {
        dataUrl: canvasToDataUrl(baseCanvas),
        historyItems: history.items,
        historyIndex: history.index,
        tool,
        updatedAt: Date.now(),
      })
    }, 700)
    return () => clearTimeout(t)
  }, [project, baseCanvas, saved, history, tool, pendingDraft])

  // Auto Save: quietly persists + snapshots a version a few seconds after the
  // last edit, when enabled in the More menu.
  useEffect(() => {
    if (!autoSaveEnabled || !project || !baseCanvas || saved || pendingDraft) return
    const t = setTimeout(() => commitSave('Auto save'), 2500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSaveEnabled, project, baseCanvas, saved, pendingDraft])

  // Commit an edit result: becomes the new base image and a new history step.
  const commitCanvas = (canvas: HTMLCanvasElement) => {
    const dataUrl = canvasToDataUrl(canvas)
    setHistory((h) => {
      const items = [...h.items.slice(0, h.index + 1), dataUrl]
      return { items, index: items.length - 1 }
    })
    setBaseCanvas(canvas)
    setPreviewCanvas(cloneCanvas(canvas))
    setSaved(false)
  }

  const goToHistory = (index: number) => {
    if (index < 0 || index >= history.items.length || index === history.index) return
    loadImage(history.items[index]).then((img) => {
      const canvas = canvasFromImage(img)
      setBaseCanvas(canvas)
      setPreviewCanvas(cloneCanvas(canvas))
      setHistory((h) => ({ ...h, index }))
      setSaved(false)
    })
  }

  const undo = () => goToHistory(history.index - 1)
  const redo = () => goToHistory(history.index + 1)

  const runAutoEnhance = () => {
    if (!baseCanvas) return
    const settings = autoEnhanceSettings(baseCanvas)
    const result = applyEnhance(baseCanvas, settings)
    commitCanvas(result)
    setEnhanceSettings({ brightness: 0, contrast: 0, saturation: 0, sharpen: 0 })
  }

  const applyEnhanceManual = () => {
    if (!previewCanvas) return
    commitCanvas(previewCanvas)
    setEnhanceSettings({ brightness: 0, contrast: 0, saturation: 0, sharpen: 0 })
  }

  const runBackgroundRemoval = () => {
    if (!baseCanvas) return
    setBusy(true)
    setTimeout(() => {
      const result = removeBackground(baseCanvas, tolerance)
      commitCanvas(result)
      setBusy(false)
    }, 150)
  }

  const runInpaint = () => {
    if (!baseCanvas || !maskCanvasRef.current) return
    setBusy(true)
    setTimeout(() => {
      const result = inpaint(baseCanvas, maskCanvasRef.current!)
      commitCanvas(result)
      clearMask()
      setBusy(false)
    }, 50)
  }

  const runReplace = () => {
    if (!baseCanvas || !maskCanvasRef.current) return
    setBusy(true)
    setTimeout(() => {
      const result = replaceColor(baseCanvas, maskCanvasRef.current!, replaceColorHex)
      commitCanvas(result)
      clearMask()
      setBusy(false)
    }, 50)
  }

  const applyFilter = (presetId: string, css: string) => {
    if (!baseCanvas) return
    const result = applyFilterPreset(baseCanvas, css)
    commitCanvas(result)
    setLastAppliedFilter(presetId)
  }

  const clearMask = () => {
    const mask = maskCanvasRef.current
    if (!mask) return
    mask.getContext('2d')!.clearRect(0, 0, mask.width, mask.height)
  }

  const clearMaskAndPreview = () => {
    clearMask()
    if (baseCanvas) setPreviewCanvas(cloneCanvas(baseCanvas))
  }

  const handleSave = () => commitSave('Manual save')

  const toggleAutoSave = () => {
    const next = !autoSaveEnabled
    setAutoSaveEnabled(next)
    updateSettings({ autoSaveEnabled: next })
  }

  const openSaveAs = () => {
    setSaveAsName(`${project?.name ?? ''} copy`)
    setShowSaveAs(true)
    setShowMore(false)
  }

  const confirmSaveAs = () => {
    if (!project || !baseCanvas) return
    persist(canvasToDataUrl(baseCanvas))
    const copy = saveProjectAs(project.id, saveAsName.trim() || `${project.name} copy`)
    setShowSaveAs(false)
    if (copy) navigate(`/editor/${copy.id}`)
  }

  const openVersions = () => {
    setShowVersions(true)
    setShowMore(false)
  }

  const handleRestoreVersion = (versionId: string) => {
    if (!project) return
    const versionEntry = project.versions.find((v) => v.id === versionId)
    const updated = restoreVersion(project.id, versionId)
    if (!versionEntry || !updated) return
    setProject(updated)
    loadIntoEditor(versionEntry.dataUrl).then((canvas) => {
      commitCanvas(canvas)
      setSaved(true)
      clearDraft(project.id)
    })
    setShowVersions(false)
  }

  const handleDeleteVersion = (versionId: string) => {
    if (!project) return
    const updated = deleteVersion(project.id, versionId)
    if (updated) setProject(updated)
  }

  const handleReset = () => {
    if (!project) return
    loadImage(project.originalData).then((img) => {
      const canvas = canvasFromImage(img)
      setBaseCanvas(canvas)
      setPreviewCanvas(cloneCanvas(canvas))
      setEnhanceSettings({ brightness: 0, contrast: 0, saturation: 0, sharpen: 0 })
      setHistory({ items: [project.originalData], index: 0 })
      setSaved(false)
    })
  }

  const canvasCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    const scaleX = el.width / rect.width
    const scaleY = el.height / rect.height
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  const paintMask = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const mask = maskCanvasRef.current
    if (!mask) return
    const { x, y } = canvasCoords(e)
    const ctx = mask.getContext('2d')!
    ctx.fillStyle = tool === 'ai-replace' ? hexToRgba(replaceColorHex, 0.85) : 'rgba(244, 114, 182, 0.85)'
    ctx.beginPath()
    ctx.arc(x, y, brushSize, 0, Math.PI * 2)
    ctx.fill()

    // Composite the mask visually onto the preview so the user sees the brush.
    if (baseCanvas) {
      const merged = cloneCanvas(baseCanvas)
      const mctx = merged.getContext('2d')!
      mctx.drawImage(mask, 0, 0)
      setPreviewCanvas(merged)
    }
  }

  const compareAfterSrc = useMemo(() => {
    if (!compareMode || !previewCanvas) return ''
    return canvasToDataUrl(previewCanvas)
  }, [compareMode, previewCanvas])

  if (project === undefined) {
    return <div className="pt-24 text-center text-sm text-white/40">Loading…</div>
  }

  if (!project) {
    return (
      <div className="pb-28">
        <TopBar title="New Edit" subtitle="Upload a photo to begin" onBack />
        <div className="px-5 mt-2">
          <div className="rounded-3xl glass p-8 sm:p-12 flex flex-col items-center text-center animate-fade-up">
            <AnimatedLogo size="lg" />
            <h2 className="font-display text-xl font-bold mt-4">Start a new edit</h2>
            <p className="text-sm text-white/50 mt-1.5 max-w-xs">
              Upload a photo to open the full editor workspace — enhance, remove backgrounds, erase
              objects, replace colors and apply looks.
            </p>
            <div className="w-full mt-6">
              <UploadDropzone onFile={handleReplace} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  const Icon = TOOL_ICONS[tool]
  const isPaintTool = tool === 'object-remover' || tool === 'magic-eraser' || tool === 'ai-replace'

  return (
    <div className="pb-40">
      <TopBar
        title={project.name}
        subtitle={autoSaveEnabled && !saved ? 'Auto-saving…' : saved ? 'All changes saved' : 'Unsaved changes'}
        onBack
      />

      {pendingDraft && (
        <div className="mx-5 mb-1 glass rounded-2xl p-4 flex items-start gap-3 animate-fade-up border border-amber-400/25">
          <div className="w-8 h-8 rounded-lg bg-amber-400/15 flex items-center justify-center shrink-0 text-amber-300">
            <AlertTriangle size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Unsaved changes found</p>
            <p className="text-xs text-white/50 mt-0.5">From a session that didn&rsquo;t get saved. Restore them?</p>
            <div className="flex gap-2 mt-2.5">
              <button
                onClick={handleDiscardDraft}
                className="px-3 py-1.5 rounded-lg glass text-xs font-medium text-white/70 active:scale-95 transition-transform"
              >
                Discard
              </button>
              <button
                onClick={handleRestoreDraft}
                className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-orange-500 text-xs font-semibold text-black active:scale-95 transition-transform"
              >
                Restore
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="px-5 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        <ToolbarButton icon={Undo2} label="Undo" onClick={undo} disabled={history.index <= 0} />
        <ToolbarButton icon={Redo2} label="Redo" onClick={redo} disabled={history.index >= history.items.length - 1} />
        <ToolbarButton icon={Columns2} label="Compare" onClick={() => setCompareMode((v) => !v)} active={compareMode} />
        <ToolbarButton icon={RotateCcw} label="Reset" onClick={handleReset} />
        <ToolbarButton icon={MoreVertical} label="More" onClick={() => setShowMore(true)} />
        <div className="flex-1" />
        <ToolbarButton icon={saved ? Check : Save} label={saved ? 'Saved' : 'Save'} onClick={handleSave} disabled={saved} primary={!saved} />
        <ToolbarButton icon={Download} label="Export" onClick={() => navigate(`/editor/${project.id}/export`)} primary />
      </div>

      <div className="px-5 mt-3 flex gap-3">
        <ToolRail tools={TOOLS} active={tool} onSelect={setTool} />

        <div className="flex-1 min-w-0">
          <div className="rounded-2xl overflow-hidden glass p-2 animate-fade-up">
            <div className="relative rounded-xl overflow-hidden bg-black/30 h-[38vh] sm:h-[48vh]">
              {compareMode && compareAfterSrc ? (
                <BeforeAfterSlider beforeSrc={project.originalData} afterSrc={compareAfterSrc} />
              ) : (
                <canvas
                  ref={displayRef}
                  className="w-full h-full object-contain touch-none"
                  onPointerDown={(e) => {
                    if (!isPaintTool) return
                    drawing.current = true
                    paintMask(e)
                  }}
                  onPointerMove={(e) => {
                    if (!drawing.current) return
                    paintMask(e)
                  }}
                  onPointerUp={() => (drawing.current = false)}
                  onPointerLeave={() => (drawing.current = false)}
                />
              )}
              {busy && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                  <div className="flex items-center gap-2 text-sm text-white/90">
                    <Icon size={16} className="animate-pulse" /> Processing…
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 glass rounded-2xl p-4 animate-fade-up">
            {tool === 'enhance' && (
              <div className="space-y-4">
                <button
                  onClick={runAutoEnhance}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 text-sm font-medium active:scale-[0.99] transition-transform"
                >
                  <Sparkles size={15} /> Auto Enhance
                </button>
                {(
                  [
                    ['brightness', 'Brightness'],
                    ['contrast', 'Contrast'],
                    ['saturation', 'Saturation'],
                    ['sharpen', 'Sharpen'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key}>
                    <div className="flex justify-between text-xs text-white/60 mb-1.5">
                      <span>{label}</span>
                      <span>{enhanceSettings[key]}</span>
                    </div>
                    <input
                      type="range"
                      min={key === 'sharpen' ? 0 : -100}
                      max={100}
                      value={enhanceSettings[key]}
                      onChange={(e) => {
                        setEnhanceSettings((s) => ({ ...s, [key]: Number(e.target.value) }))
                      }}
                      className="w-full"
                    />
                  </div>
                ))}
                <button
                  onClick={applyEnhanceManual}
                  disabled={Object.values(enhanceSettings).every((v) => v === 0)}
                  className="w-full py-2.5 rounded-xl bg-white text-black text-sm font-semibold disabled:opacity-30 active:scale-[0.99] transition-transform"
                >
                  Apply adjustments
                </button>
              </div>
            )}

            {tool === 'background-remover' && (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs text-white/60 mb-1.5">
                    <span>Edge sensitivity</span>
                    <span>{tolerance}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={tolerance}
                    onChange={(e) => setTolerance(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                <button
                  onClick={runBackgroundRemoval}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-sm font-medium active:scale-[0.99] transition-transform"
                >
                  <Scissors size={15} /> Remove Background
                </button>
                <p className="text-[11px] text-white/40 leading-snug">
                  Works best on photos with a plain, evenly lit background. Increase sensitivity for
                  soft shadows or subtle color variation.
                </p>
              </div>
            )}

            {(tool === 'object-remover' || tool === 'magic-eraser') && (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs text-white/60 mb-1.5">
                    <span>Brush size</span>
                    <span>{brushSize}px</span>
                  </div>
                  <input
                    type="range"
                    min={8}
                    max={80}
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={clearMaskAndPreview}
                    className="flex-1 py-2.5 rounded-xl glass text-sm font-medium text-white/70 active:scale-[0.99] transition-transform"
                  >
                    Clear brush
                  </button>
                  <button
                    onClick={runInpaint}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r ${activeMeta.gradient} active:scale-[0.99] transition-transform`}
                  >
                    {tool === 'magic-eraser' ? <Wand size={15} /> : <Eraser size={15} />} Erase
                  </button>
                </div>
                <p className="text-[11px] text-white/40 leading-snug">
                  Brush over the area you want gone. The AI fills it in using the surrounding
                  texture and color.
                </p>
              </div>
            )}

            {tool === 'ai-replace' && (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs text-white/60 mb-1.5">
                    <span>Brush size</span>
                    <span>{brushSize}px</span>
                  </div>
                  <input
                    type="range"
                    min={8}
                    max={80}
                    value={brushSize}
                    onChange={(e) => setBrushSize(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <p className="text-xs text-white/60 mb-2">Replacement color</p>
                  <div className="flex flex-wrap gap-2.5">
                    {REPLACE_COLORS.map((hex) => (
                      <button
                        key={hex}
                        onClick={() => setReplaceColorHex(hex)}
                        style={{ backgroundColor: hex }}
                        className={`w-8 h-8 rounded-full ring-2 transition-all active:scale-90 ${
                          replaceColorHex === hex ? 'ring-white scale-110' : 'ring-white/15'
                        }`}
                      />
                    ))}
                    <label className="w-8 h-8 rounded-full ring-2 ring-white/15 relative cursor-pointer overflow-hidden">
                      <input
                        type="color"
                        value={replaceColorHex}
                        onChange={(e) => setReplaceColorHex(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      <span className="absolute inset-0" style={{ backgroundColor: replaceColorHex }} />
                    </label>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={clearMaskAndPreview}
                    className="flex-1 py-2.5 rounded-xl glass text-sm font-medium text-white/70 active:scale-[0.99] transition-transform"
                  >
                    Clear brush
                  </button>
                  <button
                    onClick={runReplace}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-gradient-to-r from-emerald-400 to-teal-500 active:scale-[0.99] transition-transform"
                  >
                    <Replace size={15} /> Apply
                  </button>
                </div>
                <p className="text-[11px] text-white/40 leading-snug">
                  Brush over an area, then tap Apply to recolor it while keeping its original
                  shading and texture.
                </p>
              </div>
            )}

            {tool === 'ai-filters' && (
              <div className="space-y-3">
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                  {FILTER_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => applyFilter(preset.id, preset.css)}
                      className="shrink-0 flex flex-col items-center gap-1.5"
                    >
                      <span
                        className={`w-16 h-16 rounded-xl overflow-hidden ring-2 transition-all ${
                          lastAppliedFilter === preset.id ? 'ring-white scale-105' : 'ring-white/10'
                        }`}
                      >
                        {filterThumb && (
                          <img
                            src={filterThumb}
                            style={{ filter: preset.css }}
                            className="w-full h-full object-cover"
                            alt={preset.label}
                          />
                        )}
                      </span>
                      <span className="text-[10px] text-white/60">{preset.label}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-white/40 leading-snug">
                  Tap a look to apply it instantly — use Undo if you change your mind.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {history.items.length > 1 && (
        <div className="px-5 mt-5">
          <p className="text-xs text-white/40 mb-2">History</p>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {history.items.map((src, i) => (
              <button
                key={i}
                onClick={() => goToHistory(i)}
                className={`shrink-0 w-14 h-14 rounded-xl overflow-hidden ring-2 transition-all active:scale-95 ${
                  i === history.index ? 'ring-blue-400' : 'ring-white/10 opacity-60'
                }`}
              >
                <img src={src} className="w-full h-full object-cover" alt={`Step ${i}`} />
              </button>
            ))}
          </div>
        </div>
      )}

      {showMore && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowMore(false)} />
          <div className="fixed inset-x-0 bottom-0 z-50 animate-sheet-up">
            <div className="mx-auto max-w-xl sm:max-w-3xl px-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
              <div className="glass rounded-3xl p-2 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2.5">
                  <p className="text-sm font-semibold">Save options</p>
                  <button onClick={() => setShowMore(false)} className="w-7 h-7 rounded-lg glass flex items-center justify-center">
                    <X size={14} />
                  </button>
                </div>
                <button
                  onClick={toggleAutoSave}
                  className="w-full flex items-center justify-between px-3 py-3 rounded-2xl hover:bg-white/5 text-left"
                >
                  <div>
                    <p className="text-sm font-medium">Auto Save</p>
                    <p className="text-[11px] text-white/40 mt-0.5">Save automatically a few seconds after each edit</p>
                  </div>
                  <span className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${autoSaveEnabled ? 'bg-violet-500' : 'bg-white/15'}`}>
                    <span
                      className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                        autoSaveEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'
                      }`}
                    />
                  </span>
                </button>
                <button
                  onClick={openSaveAs}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-white/5 text-left"
                >
                  <FolderOutput size={17} className="text-white/70" />
                  <div>
                    <p className="text-sm font-medium">Save As…</p>
                    <p className="text-[11px] text-white/40 mt-0.5">Save a copy under a new name</p>
                  </div>
                </button>
                <button
                  onClick={openVersions}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl hover:bg-white/5 text-left"
                >
                  <HistoryIcon size={17} className="text-white/70" />
                  <div>
                    <p className="text-sm font-medium">Version History</p>
                    <p className="text-[11px] text-white/40 mt-0.5">{project.versions.length} saved version{project.versions.length === 1 ? '' : 's'}</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {showSaveAs && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowSaveAs(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
            <div className="glass rounded-3xl p-5 w-full max-w-sm animate-fade-up">
              <p className="text-sm font-semibold mb-3">Save As</p>
              <input
                autoFocus
                value={saveAsName}
                onChange={(e) => setSaveAsName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-violet-400/60"
                placeholder="Project name"
              />
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setShowSaveAs(false)}
                  className="flex-1 py-2.5 rounded-xl glass text-sm font-medium text-white/70 active:scale-95 transition-transform"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmSaveAs}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 text-sm font-semibold active:scale-95 transition-transform"
                >
                  Save Copy
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {showVersions && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={() => setShowVersions(false)} />
          <div className="fixed inset-x-0 bottom-0 z-50 animate-sheet-up">
            <div className="mx-auto max-w-xl sm:max-w-3xl px-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
              <div className="glass rounded-3xl p-4 max-h-[70vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold">Version History</p>
                  <button onClick={() => setShowVersions(false)} className="w-7 h-7 rounded-lg glass flex items-center justify-center">
                    <X size={14} />
                  </button>
                </div>
                {project.versions.length === 0 ? (
                  <p className="text-xs text-white/40 py-6 text-center">
                    No saved versions yet. Tap Save, or turn on Auto Save, to start building history.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {project.versions.map((v) => (
                      <div key={v.id} className="flex items-center gap-3 glass rounded-xl p-2">
                        <img src={v.dataUrl} className="w-11 h-11 rounded-lg object-cover shrink-0" alt={v.label} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{v.label}</p>
                          <p className="text-[11px] text-white/40">{new Date(v.createdAt).toLocaleString()}</p>
                        </div>
                        <button
                          onClick={() => handleRestoreVersion(v.id)}
                          className="w-8 h-8 shrink-0 rounded-lg glass flex items-center justify-center text-white/70 active:scale-90 transition-transform"
                          title="Restore this version"
                        >
                          <RotateCw size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteVersion(v.id)}
                          className="w-8 h-8 shrink-0 rounded-lg glass flex items-center justify-center text-white/40 active:scale-90 transition-transform"
                          title="Delete this version"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const bigint = parseInt(clean, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
