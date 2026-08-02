import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from '@/lib/router-compat'
import {
  Sparkles, Scissors, Eraser, Wand2, Crop, SlidersHorizontal, Type, Sticker, Download,
  Undo2, Redo2, RotateCcw, Save, Check, ZoomIn, ZoomOut, Maximize2, ChevronLeft, Layers,
  Share2, Brush, Scaling, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen,
  History, Trash2, Lock,
} from 'lucide-react'
import { UploadDropzone } from '../components/UploadDropzone'
import { AnimatedLogo } from '../components/AnimatedLogo'
import {
  addVersion, clearDraft, getProject, loadProjects, saveProject, setLastProjectId,
} from '../lib/storage'
import { createProjectFromFile } from '../lib/projectActions'
import {
  applyEnhance, applyFilterPreset, autoEnhanceSettings, canvasFromImage, canvasToDataUrl,
  cloneCanvas, FILTER_PRESETS, inpaint, loadImage, removeBackground, type EnhanceSettings,
} from '../lib/imageEffects'
import {
  ASPECT_PRESETS, cropCanvas, drawSticker, drawText, flattenLayer, FONT_FAMILIES, RESIZE_PRESETS,
  resizeCanvas, DRAW_COLORS, STICKERS,
  type CropRect, type StickerOverlay, type TextOverlay,
} from '../lib/workspaceEffects'
import { canUseFileShare, dataUrlToFile, shareFile } from '../lib/share'
import type { Project } from '../types'

type WsTool =
  | 'enhance' | 'background-remover' | 'object-remover' | 'magic-eraser'
  | 'crop' | 'resize' | 'filters' | 'text' | 'stickers' | 'draw' | 'layers' | 'export'

const WS_TOOLS: { id: WsTool; label: string; icon: typeof Sparkles; hint: string }[] = [
  { id: 'enhance', label: 'AI Enhance', icon: Sparkles, hint: 'Light, colour & detail' },
  { id: 'background-remover', label: 'Background', icon: Scissors, hint: 'Cut out the subject' },
  { id: 'object-remover', label: 'Object Remover', icon: Wand2, hint: 'Paint over what to remove' },
  { id: 'magic-eraser', label: 'Magic Eraser', icon: Eraser, hint: 'Erase blemishes & marks' },
  { id: 'crop', label: 'Crop', icon: Crop, hint: 'Reframe your shot' },
  { id: 'resize', label: 'Resize', icon: Scaling, hint: 'Exact pixel dimensions' },
  { id: 'filters', label: 'Filters', icon: SlidersHorizontal, hint: 'One-tap looks' },
  { id: 'text', label: 'Text', icon: Type, hint: 'Add a headline' },
  { id: 'stickers', label: 'Stickers', icon: Sticker, hint: 'Drop in graphics' },
  { id: 'draw', label: 'Draw', icon: Brush, hint: 'Freehand brush' },
  { id: 'layers', label: 'Layers', icon: Layers, hint: 'Edit history stack' },
  { id: 'export', label: 'Export', icon: Download, hint: 'Save & share' },
]

const PAINT_TOOLS: WsTool[] = ['object-remover', 'magic-eraser']


/* ---------------------------------- atoms --------------------------------- */

function Slider({
  label, value, min, max, step = 1, suffix, onChange,
}: {
  label: string; value: number; min: number; max: number; step?: number; suffix?: string
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex justify-between text-xs text-white/55 mb-1.5">
        <span>{label}</span>
        <span className="tabular-nums text-white/80">{value}{suffix}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-violet-400"
      />
    </div>
  )
}

function PrimaryButton({
  children, onClick, disabled,
}: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 text-sm font-semibold text-white shadow-lg shadow-violet-900/40 transition-transform active:scale-[0.99] disabled:opacity-30"
    >
      {children}
    </button>
  )
}

function GhostButton({
  children, onClick, disabled,
}: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl glass text-sm font-medium text-white/75 hover:text-white transition-all active:scale-[0.99] disabled:opacity-30"
    >
      {children}
    </button>
  )
}

function IconAction({
  icon: Icon, label, onClick, disabled, active, accent,
}: {
  icon: typeof Undo2; label: string; onClick: () => void
  disabled?: boolean; active?: boolean; accent?: boolean
}) {
  return (
    <button
      onClick={onClick} disabled={disabled} title={label} aria-label={label}
      className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all active:scale-95 disabled:opacity-30 ${
        accent
          ? 'bg-gradient-to-r from-blue-500 to-violet-500 text-white shadow-lg shadow-violet-900/30'
          : active ? 'glass text-white' : 'glass text-white/60 hover:text-white/90'
      }`}
    >
      <Icon size={14} />
      <span className="hidden md:inline">{label}</span>
    </button>
  )
}

/* -------------------------------- workspace ------------------------------- */

export function Workspace() {
  const navigate = useNavigate()
  const params = useParams<{ projectId?: string }>()
  const [searchParams] = useSearchParams()

  const [project, setProject] = useState<Project | null | undefined>(undefined)
  const [tool, setTool] = useState<WsTool>(((searchParams.get('tool') as WsTool) || 'enhance'))
  const [baseCanvas, setBaseCanvas] = useState<HTMLCanvasElement | null>(null)
  const [previewCanvas, setPreviewCanvas] = useState<HTMLCanvasElement | null>(null)
  const [history, setHistory] = useState<{ items: string[]; index: number }>({ items: [], index: -1 })
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(true)
  const [zoom, setZoom] = useState(1)
  const [panelOpen, setPanelOpen] = useState(true)
  const [railOpen, setRailOpen] = useState(true)
  const [shareState, setShareState] = useState<'idle' | 'sharing' | 'done' | 'unsupported'>('idle')

  // tool state
  const [enhanceSettings, setEnhanceSettings] = useState<EnhanceSettings>({ brightness: 0, contrast: 0, saturation: 0, sharpen: 0 })
  const [tolerance, setTolerance] = useState(35)
  const [brushSize, setBrushSize] = useState(28)
  const [activeFilter, setActiveFilter] = useState('none')
  const [crop, setCrop] = useState<CropRect>({ x: 0.08, y: 0.08, w: 0.84, h: 0.84 })
  const [aspect, setAspect] = useState('free')
  const [resizeDims, setResizeDims] = useState({ w: 0, h: 0 })
  const [lockRatio, setLockRatio] = useState(true)
  const [drawColor, setDrawColor] = useState('#a78bfa')
  const [drawSize, setDrawSize] = useState(14)
  const [drawDirty, setDrawDirty] = useState(false)
  const [text, setText] = useState<TextOverlay>({
    text: 'Your headline', x: 0.5, y: 0.5, size: 0.12, color: '#ffffff', weight: 700,
    family: 'Sora, sans-serif', shadow: true,
  })
  const [sticker, setSticker] = useState<StickerOverlay>({ glyph: '✨', x: 0.5, y: 0.5, size: 0.2, rotation: 0 })

  const maskRef = useRef<HTMLCanvasElement | null>(null)
  const drawLayerRef = useRef<HTMLCanvasElement | null>(null)
  const lastPoint = useRef<{ x: number; y: number } | null>(null)
  const displayRef = useRef<HTMLCanvasElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 })


  const drawing = useRef(false)
  const dragging = useRef<null | 'crop-move' | 'crop-resize' | 'text' | 'sticker'>(null)

  /* ------------------------------ project load ---------------------------- */
  useEffect(() => {
    let id = params.projectId
    if (!id || id === 'latest') id = loadProjects()[0]?.id
    if (!id) { setProject(null); return }
    const p = getProject(id)
    setProject(p ?? null)
    if (p) setLastProjectId(p.id)
  }, [params.projectId])

  const makeLayers = (canvas: HTMLCanvasElement) => {
    const mask = document.createElement('canvas')
    mask.width = canvas.width
    mask.height = canvas.height
    maskRef.current = mask
    const layer = document.createElement('canvas')
    layer.width = canvas.width
    layer.height = canvas.height
    drawLayerRef.current = layer
    setDrawDirty(false)
    setResizeDims({ w: canvas.width, h: canvas.height })
  }

  const loadInto = (dataUrl: string) =>
    loadImage(dataUrl).then((img) => {
      const canvas = canvasFromImage(img)
      setBaseCanvas(canvas)
      setPreviewCanvas(cloneCanvas(canvas))
      setHistory({ items: [dataUrl], index: 0 })
      makeLayers(canvas)
      return canvas
    })


  useEffect(() => {
    if (!project) return
    let cancelled = false
    loadInto(project.currentData).then(() => { if (cancelled) return })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id])

  /* ------------------------------- rendering ------------------------------ */
  useEffect(() => {
    const display = displayRef.current
    const canvas = previewCanvas
    if (!display || !canvas) return
    display.width = canvas.width
    display.height = canvas.height
    const ctx = display.getContext('2d')!
    ctx.clearRect(0, 0, display.width, display.height)
    const tile = 18
    for (let y = 0; y < display.height; y += tile) {
      for (let x = 0; x < display.width; x += tile) {
        ctx.fillStyle = (x / tile + y / tile) % 2 === 0 ? '#181826' : '#12121c'
        ctx.fillRect(x, y, tile, tile)
      }
    }
    ctx.drawImage(canvas, 0, 0)
  }, [previewCanvas])

  // live enhance preview
  useEffect(() => {
    if (!baseCanvas || tool !== 'enhance') return
    setPreviewCanvas(applyEnhance(baseCanvas, enhanceSettings))
  }, [baseCanvas, enhanceSettings, tool])

  // reset scratch state on tool / image change
  useEffect(() => {
    if (!baseCanvas) return
    clearMask()
    clearDrawLayer()
    if (tool === 'enhance') setEnhanceSettings({ brightness: 0, contrast: 0, saturation: 0, sharpen: 0 })
    else setPreviewCanvas(cloneCanvas(baseCanvas))
    if (tool === 'crop') { setCrop({ x: 0.08, y: 0.08, w: 0.84, h: 0.84 }); setAspect('free') }
    if (tool === 'resize') setResizeDims({ w: baseCanvas.width, h: baseCanvas.height })
    if (tool === 'filters') setActiveFilter('none')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseCanvas, tool])


  const activeMeta = useMemo(() => WS_TOOLS.find((t) => t.id === tool)!, [tool])

  /* -------------------------------- history ------------------------------- */
  const commitCanvas = (canvas: HTMLCanvasElement) => {
    const dataUrl = canvasToDataUrl(canvas)
    setHistory((h) => {
      const items = [...h.items.slice(0, h.index + 1), dataUrl]
      return { items, index: items.length - 1 }
    })
    setBaseCanvas(canvas)
    setPreviewCanvas(cloneCanvas(canvas))
    setSaved(false)
    makeLayers(canvas)
  }


  const goToHistory = (index: number) => {
    const item = history.items[index]
    if (!item) return
    loadImage(item).then((img) => {
      const canvas = canvasFromImage(img)
      setBaseCanvas(canvas)
      setPreviewCanvas(cloneCanvas(canvas))
      setHistory((h) => ({ ...h, index }))
      setSaved(false)
    })
  }

  const undo = () => goToHistory(history.index - 1)
  const redo = () => goToHistory(history.index + 1)

  const handleSave = () => {
    if (!baseCanvas || !project) return
    const dataUrl = canvasToDataUrl(baseCanvas)
    const updated: Project = { ...project, currentData: dataUrl, updatedAt: Date.now() }
    saveProject(updated)
    addVersion(project.id, dataUrl, 'Workspace save')
    setProject(updated)
    setSaved(true)
    clearDraft(project.id)
  }

  const handleReset = () => {
    if (!project) return
    loadInto(project.originalData).then(() => setSaved(false))
  }

  const withBusy = async (fn: () => HTMLCanvasElement) => {
    setBusy(true)
    await new Promise((r) => setTimeout(r, 30))
    try { commitCanvas(fn()) } finally { setBusy(false) }
  }

  /* --------------------------------- mask --------------------------------- */
  function clearMask() {
    const mask = maskRef.current
    if (!mask) return
    mask.getContext('2d')!.clearRect(0, 0, mask.width, mask.height)
  }

  const clearMaskAndPreview = () => {
    clearMask()
    if (baseCanvas) setPreviewCanvas(cloneCanvas(baseCanvas))
  }

  function clearDrawLayer() {
    const layer = drawLayerRef.current
    if (!layer) return
    layer.getContext('2d')!.clearRect(0, 0, layer.width, layer.height)
    setDrawDirty(false)
  }

  const clearDrawAndPreview = () => {
    clearDrawLayer()
    if (baseCanvas) setPreviewCanvas(cloneCanvas(baseCanvas))
  }

  const canvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (el.width / rect.width),
      y: (e.clientY - rect.top) * (el.height / rect.height),
    }
  }

  const paintMask = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const mask = maskRef.current
    if (!mask || !baseCanvas) return
    const { x, y } = canvasPoint(e)
    const ctx = mask.getContext('2d')!
    ctx.fillStyle = 'rgba(167, 139, 250, 0.85)'
    ctx.beginPath()
    ctx.arc(x, y, brushSize, 0, Math.PI * 2)
    ctx.fill()
    const merged = cloneCanvas(baseCanvas)
    merged.getContext('2d')!.drawImage(mask, 0, 0)
    setPreviewCanvas(merged)
  }

  const paintDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const layer = drawLayerRef.current
    if (!layer || !baseCanvas) return
    const { x, y } = canvasPoint(e)
    const ctx = layer.getContext('2d')!
    ctx.strokeStyle = drawColor
    ctx.fillStyle = drawColor
    ctx.lineWidth = drawSize * 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const prev = lastPoint.current
    if (prev) {
      ctx.beginPath()
      ctx.moveTo(prev.x, prev.y)
      ctx.lineTo(x, y)
      ctx.stroke()
    } else {
      ctx.beginPath()
      ctx.arc(x, y, drawSize, 0, Math.PI * 2)
      ctx.fill()
    }
    lastPoint.current = { x, y }
    setDrawDirty(true)
    setPreviewCanvas(flattenLayer(baseCanvas, layer))
  }

  const applyDraw = () => {
    const layer = drawLayerRef.current
    if (!baseCanvas || !layer || !drawDirty) return
    void withBusy(() => flattenLayer(baseCanvas, layer))
  }


  /* ------------------------------ tool actions ---------------------------- */
  const runAutoEnhance = () => {
    if (!baseCanvas) return
    setEnhanceSettings(autoEnhanceSettings(baseCanvas))
  }

  const applyEnhanceNow = () => {
    if (!baseCanvas) return
    void withBusy(() => applyEnhance(baseCanvas, enhanceSettings))
  }

  const applyBackgroundRemoval = () => {
    if (!baseCanvas) return
    void withBusy(() => removeBackground(baseCanvas, tolerance))
  }

  const applyInpaint = () => {
    if (!baseCanvas || !maskRef.current) return
    const mask = maskRef.current
    void withBusy(() => inpaint(baseCanvas, mask, tool === 'magic-eraser' ? 140 : 220))
  }

  const applyCrop = () => {
    if (!baseCanvas) return
    void withBusy(() => cropCanvas(baseCanvas, crop))
  }

  const applyResize = () => {
    if (!baseCanvas || resizeDims.w < 1 || resizeDims.h < 1) return
    void withBusy(() => resizeCanvas(baseCanvas, resizeDims.w, resizeDims.h))
  }

  const setResizeWidth = (w: number) => {
    if (!baseCanvas) return
    const ratio = baseCanvas.height / baseCanvas.width
    setResizeDims((d) => ({ w, h: lockRatio ? Math.round(w * ratio) : d.h }))
  }

  const setResizeHeight = (h: number) => {
    if (!baseCanvas) return
    const ratio = baseCanvas.width / baseCanvas.height
    setResizeDims((d) => ({ w: lockRatio ? Math.round(h * ratio) : d.w, h }))
  }

  const handleShare = async () => {
    if (!baseCanvas) return
    setShareState('sharing')
    const filename = `${project?.name ?? 'magicedit'}.png`
    const file = dataUrlToFile(canvasToDataUrl(baseCanvas), filename, 'image/png')
    if (!canUseFileShare(file)) { setShareState('unsupported'); return }
    const result = await shareFile(file, project?.name ?? 'MagicEdit AI')
    setShareState(result === 'shared' ? 'done' : 'idle')
    setTimeout(() => setShareState('idle'), 2000)
  }


  const previewFilter = (id: string, css: string) => {
    if (!baseCanvas) return
    setActiveFilter(id)
    setPreviewCanvas(css === 'none' ? cloneCanvas(baseCanvas) : applyFilterPreset(baseCanvas, css))
  }

  const applyFilterNow = () => {
    if (!baseCanvas) return
    const preset = FILTER_PRESETS.find((p) => p.id === activeFilter)
    if (!preset || preset.css === 'none') return
    void withBusy(() => applyFilterPreset(baseCanvas, preset.css))
  }

  const applyText = () => {
    if (!baseCanvas || !text.text.trim()) return
    void withBusy(() => drawText(baseCanvas, text))
  }

  const applySticker = () => {
    if (!baseCanvas) return
    void withBusy(() => drawSticker(baseCanvas, sticker))
  }

  const quickDownload = () => {
    if (!baseCanvas) return
    const a = document.createElement('a')
    a.href = canvasToDataUrl(baseCanvas)
    a.download = `${project?.name ?? 'magicedit'}.png`
    a.click()
  }

  const handleUpload = async (file: File) => {
    const created = await createProjectFromFile(file)
    navigate(`/workspace/${created.id}?tool=${tool}`, { replace: true })
  }

  /* --------------------------- overlay dragging --------------------------- */
  // Track the rendered stage box so overlay text/stickers scale with the canvas.
  useEffect(() => {
    const el = stageRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect()
      setStageSize({ w: rect.width, h: rect.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [project?.id, tool, panelOpen])


  const stageFraction = (clientX: number, clientY: number) => {
    const el = stageRef.current
    if (!el) return { fx: 0.5, fy: 0.5 }
    const rect = el.getBoundingClientRect()
    return {
      fx: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
      fy: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
    }
  }

  const onStagePointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return
    const { fx, fy } = stageFraction(e.clientX, e.clientY)
    if (dragging.current === 'text') setText((t) => ({ ...t, x: fx, y: fy }))
    if (dragging.current === 'sticker') setSticker((s) => ({ ...s, x: fx, y: fy }))
    if (dragging.current === 'crop-move') {
      setCrop((c) => ({
        ...c,
        x: Math.min(Math.max(0, fx - c.w / 2), 1 - c.w),
        y: Math.min(Math.max(0, fy - c.h / 2), 1 - c.h),
      }))
    }
    if (dragging.current === 'crop-resize') {
      setCrop((c) => {
        const w = Math.min(Math.max(0.08, fx - c.x), 1 - c.x)
        const ratio = ASPECT_PRESETS.find((p) => p.id === aspect)?.ratio ?? null
        const source = baseCanvas
        let h = Math.min(Math.max(0.08, fy - c.y), 1 - c.y)
        if (ratio && source) h = Math.min((w * source.width) / ratio / source.height, 1 - c.y)
        return { ...c, w, h }
      })
    }
  }

  const endDrag = () => { dragging.current = null }

  useEffect(() => {
    const ratio = ASPECT_PRESETS.find((p) => p.id === aspect)?.ratio ?? null
    if (!ratio || !baseCanvas) return
    setCrop((c) => {
      const h = Math.min((c.w * baseCanvas.width) / ratio / baseCanvas.height, 1 - c.y)
      return { ...c, h }
    })
  }, [aspect, baseCanvas])

  /* --------------------------------- empty -------------------------------- */
  if (project === undefined) {
    return <div className="pt-24 text-center text-sm text-white/40">Loading workspace…</div>
  }

  if (!project) {
    return (
      <div className="pb-32 px-5">
        <div className="max-w-lg mx-auto rounded-3xl glass p-8 sm:p-12 flex flex-col items-center text-center mt-8 animate-fade-up">
          <AnimatedLogo size="lg" />
          <h1 className="font-display text-2xl font-bold mt-4">AI Photo Workspace</h1>
          <p className="text-sm text-white/50 mt-2 max-w-sm">
            A full pro editing surface — AI enhance, background removal, magic eraser, crop,
            filters, text and stickers. Upload a photo to begin.
          </p>
          <div className="w-full mt-6"><UploadDropzone onFile={handleUpload} /></div>
        </div>
      </div>
    )
  }

  const isPaint = PAINT_TOOLS.includes(tool)
  const ratioStyle = baseCanvas ? { aspectRatio: `${baseCanvas.width} / ${baseCanvas.height}` } : undefined

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden flex flex-col bg-[#0a0a12]/60 pb-24 lg:pb-0">
      {/* ------------------------------ top bar ----------------------------- */}
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 border-b border-white/5 bg-gradient-to-r from-blue-600/10 via-violet-600/10 to-transparent">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={() => navigate('/projects')}
            aria-label="Back to projects"
            className="shrink-0 w-9 h-9 rounded-xl glass flex items-center justify-center text-white/70 hover:text-white transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="truncate font-display text-sm sm:text-base font-bold">{project.name}</h1>
            <p className="truncate text-[11px] text-white/40">
              {saved ? 'All changes saved' : 'Unsaved changes'} · {activeMeta.label}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <IconAction icon={railOpen ? PanelLeftClose : PanelLeftOpen} label="Tools" onClick={() => setRailOpen((v) => !v)} active={railOpen} />
          <IconAction icon={Undo2} label="Undo" onClick={undo} disabled={history.index <= 0} />
          <IconAction icon={Redo2} label="Redo" onClick={redo} disabled={history.index >= history.items.length - 1} />
          <IconAction icon={RotateCcw} label="Reset" onClick={handleReset} />
          <IconAction icon={ZoomOut} label="Zoom out" onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)))} />
          <span className="shrink-0 w-11 text-center text-[11px] tabular-nums text-white/60">{Math.round(zoom * 100)}%</span>
          <IconAction icon={ZoomIn} label="Zoom in" onClick={() => setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2)))} />
          <IconAction icon={Download} label="Download" onClick={quickDownload} />
          <IconAction
            icon={shareState === 'done' ? Check : Share2}
            label={shareState === 'unsupported' ? 'Downloaded' : shareState === 'sharing' ? 'Sharing…' : 'Share'}
            onClick={() => { if (shareState === 'unsupported') { quickDownload(); setShareState('idle') } else void handleShare() }}
          />
          <IconAction icon={panelOpen ? PanelRightClose : PanelRightOpen} label="Panel" onClick={() => setPanelOpen((v) => !v)} active={panelOpen} />
          <IconAction icon={saved ? Check : Save} label={saved ? 'Saved' : 'Save'} onClick={handleSave} disabled={saved} accent={!saved} />
          <IconAction icon={Download} label="Export" onClick={() => navigate(`/editor/${project.id}/export`)} accent />
        </div>

      </header>

      <div className="flex-1 flex min-h-0 flex-col lg:flex-row">
        {/* ---------------------------- left toolbar -------------------------- */}
        <nav
          className={`shrink-0 border-b lg:border-b-0 lg:border-r border-white/5 bg-white/[0.02] transition-all duration-300 ${
            railOpen ? 'lg:w-[104px]' : 'lg:w-[60px]'
          }`}
        >
          <div className="flex lg:flex-col gap-1.5 p-2 overflow-x-auto lg:overflow-y-auto no-scrollbar">
            {WS_TOOLS.map(({ id, label, icon: Icon }) => {
              const active = tool === id
              return (
                <button
                  key={id}
                  onClick={() => (id === 'export' ? navigate(`/editor/${project.id}/export`) : setTool(id))}
                  title={label}
                  className={`shrink-0 lg:w-full flex lg:flex-col items-center justify-center gap-1 px-3 lg:px-1 py-2.5 rounded-2xl transition-all active:scale-95 ${
                    active
                      ? 'bg-gradient-to-br from-blue-500/90 to-violet-600/90 text-white shadow-lg shadow-violet-900/40'
                      : 'text-white/45 hover:text-white/90 hover:bg-white/5'
                  }`}
                >
                  <Icon size={18} />
                  <span
                    className={`text-[10px] font-medium leading-tight lg:text-center whitespace-nowrap lg:whitespace-normal ${
                      railOpen ? '' : 'lg:hidden'
                    }`}
                  >
                    {label}
                  </span>
                </button>
              )
            })}
          </div>
        </nav>

        {/* ------------------------------ canvas ------------------------------ */}
        <main className="flex-1 min-w-0 flex flex-col">
          <div className="flex-1 h-[46vh] lg:h-auto lg:min-h-0 relative flex items-center justify-center p-4 sm:p-6 overflow-hidden bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.10),transparent_60%)]">
            <div
              ref={stageRef}
              style={{ ...ratioStyle, transform: `scale(${zoom})` }}
              className="relative max-w-full max-h-full rounded-2xl overflow-hidden ring-1 ring-white/10 shadow-2xl shadow-black/60 transition-transform duration-200"
              onPointerMove={onStagePointerMove}
              onPointerUp={endDrag}
              onPointerLeave={endDrag}
            >
              <canvas
                ref={displayRef}
                className="w-full h-full block touch-none"
                onPointerDown={(e) => {
                  if (isPaint) { drawing.current = true; paintMask(e); return }
                  if (tool === 'draw') { drawing.current = true; lastPoint.current = null; paintDraw(e) }
                }}
                onPointerMove={(e) => {
                  if (!drawing.current) return
                  if (isPaint) paintMask(e)
                  else if (tool === 'draw') paintDraw(e)
                }}
                onPointerUp={() => { drawing.current = false; lastPoint.current = null }}
                onPointerLeave={() => { drawing.current = false; lastPoint.current = null }}
              />


              {/* crop overlay */}
              {tool === 'crop' && (
                <>
                  <div className="absolute inset-0 bg-black/50 pointer-events-none" />
                  <div
                    className="absolute border-2 border-violet-400/90 cursor-move"
                    style={{
                      left: `${crop.x * 100}%`, top: `${crop.y * 100}%`,
                      width: `${crop.w * 100}%`, height: `${crop.h * 100}%`,
                      boxShadow: '0 0 0 9999px rgba(0,0,0,0)',
                      backdropFilter: 'brightness(1.9)',
                    }}
                    onPointerDown={() => (dragging.current = 'crop-move')}
                  >
                    <div
                      className="absolute -right-2 -bottom-2 w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 cursor-nwse-resize ring-2 ring-white/70"
                      onPointerDown={(e) => { e.stopPropagation(); dragging.current = 'crop-resize' }}
                    />
                  </div>
                </>
              )}

              {/* text overlay */}
              {tool === 'text' && (
                <div
                  className="absolute select-none cursor-move whitespace-pre text-center leading-tight"
                  style={{
                    left: `${text.x * 100}%`, top: `${text.y * 100}%`,
                    transform: 'translate(-50%,-50%)',
                    fontSize: `${Math.max(8, text.size * stageSize.h)}px`,
                    color: text.color,
                    fontWeight: text.weight, fontFamily: text.family,
                    textShadow: text.shadow ? '0 2px 12px rgba(0,0,0,0.6)' : 'none',
                  }}
                  onPointerDown={() => (dragging.current = 'text')}
                >
                  {text.text}
                </div>
              )}

              {/* sticker overlay */}
              {tool === 'stickers' && (
                <div
                  className="absolute select-none cursor-move leading-none"
                  style={{
                    left: `${sticker.x * 100}%`, top: `${sticker.y * 100}%`,
                    transform: `translate(-50%,-50%) rotate(${sticker.rotation}deg)`,
                    fontSize: `${Math.max(12, sticker.size * stageSize.h)}px`,
                  }}
                  onPointerDown={() => (dragging.current = 'sticker')}
                >
                  {sticker.glyph}
                </div>
              )}


              {busy && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                  <div className="flex items-center gap-2 text-sm text-white/90">
                    <activeMeta.icon size={16} className="animate-pulse" /> Processing…
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* canvas footer */}
          <div className="flex items-center justify-between gap-3 px-4 py-2 border-t border-white/5 text-[11px] text-white/40">
            <span className="truncate">
              {baseCanvas ? `${baseCanvas.width} × ${baseCanvas.height}px` : '—'}
            </span>
            <div className="flex items-center gap-1.5">
              <button aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)))} className="w-8 h-8 rounded-lg glass flex items-center justify-center text-white/60 hover:text-white"><ZoomOut size={14} /></button>
              <span className="w-10 text-center tabular-nums text-white/70">{Math.round(zoom * 100)}%</span>
              <button aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2)))} className="w-8 h-8 rounded-lg glass flex items-center justify-center text-white/60 hover:text-white"><ZoomIn size={14} /></button>
              <button aria-label="Fit to screen" onClick={() => setZoom(1)} className="w-8 h-8 rounded-lg glass flex items-center justify-center text-white/60 hover:text-white"><Maximize2 size={14} /></button>
            </div>
          </div>
        </main>

        {/* -------------------------- properties panel ------------------------ */}
        {panelOpen && (
          <aside className="lg:w-[340px] shrink-0 border-t lg:border-t-0 lg:border-l border-white/5 bg-white/[0.02] lg:overflow-y-auto">
            <div className="p-4 space-y-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
                    <activeMeta.icon size={15} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{activeMeta.label}</p>
                    <p className="text-[11px] text-white/40 truncate">{activeMeta.hint}</p>
                  </div>
                </div>
              </div>

              {tool === 'enhance' && (
                <div className="space-y-4">
                  <PrimaryButton onClick={runAutoEnhance}><Sparkles size={15} /> Auto Enhance</PrimaryButton>
                  <Slider label="Brightness" value={enhanceSettings.brightness} min={-100} max={100}
                    onChange={(v) => setEnhanceSettings((s) => ({ ...s, brightness: v }))} />
                  <Slider label="Contrast" value={enhanceSettings.contrast} min={-100} max={100}
                    onChange={(v) => setEnhanceSettings((s) => ({ ...s, contrast: v }))} />
                  <Slider label="Saturation" value={enhanceSettings.saturation} min={-100} max={100}
                    onChange={(v) => setEnhanceSettings((s) => ({ ...s, saturation: v }))} />
                  <Slider label="Sharpen" value={enhanceSettings.sharpen} min={0} max={100}
                    onChange={(v) => setEnhanceSettings((s) => ({ ...s, sharpen: v }))} />
                  <GhostButton onClick={applyEnhanceNow} disabled={Object.values(enhanceSettings).every((v) => v === 0)}>
                    <Check size={15} /> Apply enhance
                  </GhostButton>
                </div>
              )}

              {tool === 'background-remover' && (
                <div className="space-y-4">
                  <p className="text-xs text-white/45 leading-relaxed">
                    Detects the backdrop from the image edges. Raise the tolerance for busier backgrounds.
                  </p>
                  <Slider label="Tolerance" value={tolerance} min={5} max={90} onChange={setTolerance} />
                  <PrimaryButton onClick={applyBackgroundRemoval}><Scissors size={15} /> Remove background</PrimaryButton>
                </div>
              )}

              {isPaint && (
                <div className="space-y-4">
                  <p className="text-xs text-white/45 leading-relaxed">
                    Paint over the area on the canvas, then apply. The surrounding pixels are blended in.
                  </p>
                  <Slider label="Brush size" value={brushSize} min={6} max={90} suffix="px" onChange={setBrushSize} />
                  <PrimaryButton onClick={applyInpaint}>
                    {tool === 'magic-eraser' ? <Eraser size={15} /> : <Wand2 size={15} />} Apply
                  </PrimaryButton>
                  <GhostButton onClick={clearMaskAndPreview}>Clear selection</GhostButton>
                </div>
              )}

              {tool === 'crop' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    {ASPECT_PRESETS.map((p) => (
                      <button
                        key={p.id} onClick={() => setAspect(p.id)}
                        className={`py-2 rounded-xl text-xs font-medium transition-all ${
                          aspect === p.id ? 'bg-gradient-to-r from-blue-500 to-violet-500 text-white' : 'glass text-white/60 hover:text-white'
                        }`}
                      >{p.label}</button>
                    ))}
                  </div>
                  <Slider label="Width" value={Math.round(crop.w * 100)} min={10} max={100} suffix="%"
                    onChange={(v) => setCrop((c) => ({ ...c, w: Math.min(v / 100, 1 - c.x) }))} />
                  <Slider label="Height" value={Math.round(crop.h * 100)} min={10} max={100} suffix="%"
                    onChange={(v) => setCrop((c) => ({ ...c, h: Math.min(v / 100, 1 - c.y) }))} />
                  <PrimaryButton onClick={applyCrop}><Crop size={15} /> Apply crop</PrimaryButton>
                </div>
              )}

              {tool === 'filters' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    {FILTER_PRESETS.map((p) => (
                      <button
                        key={p.id} onClick={() => previewFilter(p.id, p.css)}
                        className={`py-3 rounded-xl text-xs font-medium transition-all ${
                          activeFilter === p.id ? 'bg-gradient-to-r from-blue-500 to-violet-500 text-white' : 'glass text-white/60 hover:text-white'
                        }`}
                      >{p.label}</button>
                    ))}
                  </div>
                  <PrimaryButton onClick={applyFilterNow} disabled={activeFilter === 'none'}>
                    <Check size={15} /> Apply filter
                  </PrimaryButton>
                </div>
              )}

              {tool === 'text' && (
                <div className="space-y-4">
                  <textarea
                    value={text.text} rows={2}
                    onChange={(e) => setText((t) => ({ ...t, text: e.target.value }))}
                    placeholder="Type your text"
                    className="w-full rounded-xl glass px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:ring-2 focus:ring-violet-500/50"
                  />
                  <div className="grid grid-cols-4 gap-2">
                    {FONT_FAMILIES.map((f) => (
                      <button
                        key={f.id} onClick={() => setText((t) => ({ ...t, family: f.id }))}
                        className={`py-2 rounded-xl text-[11px] font-medium transition-all ${
                          text.family === f.id ? 'bg-gradient-to-r from-blue-500 to-violet-500 text-white' : 'glass text-white/60'
                        }`}
                      >{f.label}</button>
                    ))}
                  </div>
                  <Slider label="Size" value={Math.round(text.size * 100)} min={3} max={40} suffix="%"
                    onChange={(v) => setText((t) => ({ ...t, size: v / 100 }))} />
                  <Slider label="Weight" value={text.weight} min={300} max={900} step={100}
                    onChange={(v) => setText((t) => ({ ...t, weight: v }))} />
                  <div className="flex items-center justify-between text-xs text-white/55">
                    <span>Colour</span>
                    <input type="color" value={text.color} aria-label="Text colour"
                      onChange={(e) => setText((t) => ({ ...t, color: e.target.value }))}
                      className="w-10 h-8 rounded-lg bg-transparent" />
                  </div>
                  <label className="flex items-center justify-between text-xs text-white/55">
                    <span>Drop shadow</span>
                    <input type="checkbox" checked={text.shadow}
                      onChange={(e) => setText((t) => ({ ...t, shadow: e.target.checked }))} />
                  </label>
                  <PrimaryButton onClick={applyText} disabled={!text.text.trim()}><Type size={15} /> Add text</PrimaryButton>
                </div>
              )}

              {tool === 'stickers' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-5 gap-2">
                    {STICKERS.map((glyph) => (
                      <button
                        key={glyph} onClick={() => setSticker((s) => ({ ...s, glyph }))}
                        className={`aspect-square rounded-xl text-lg transition-all ${
                          sticker.glyph === glyph ? 'bg-gradient-to-br from-blue-500 to-violet-500' : 'glass hover:bg-white/10'
                        }`}
                      >{glyph}</button>
                    ))}
                  </div>
                  <Slider label="Size" value={Math.round(sticker.size * 100)} min={5} max={70} suffix="%"
                    onChange={(v) => setSticker((s) => ({ ...s, size: v / 100 }))} />
                  <Slider label="Rotation" value={sticker.rotation} min={-180} max={180} suffix="°"
                    onChange={(v) => setSticker((s) => ({ ...s, rotation: v }))} />
                  <PrimaryButton onClick={applySticker}><Sticker size={15} /> Add sticker</PrimaryButton>
                </div>
              )}

              <div className="pt-2 space-y-2 border-t border-white/5">
                <GhostButton onClick={quickDownload}><Download size={15} /> Quick download PNG</GhostButton>
                <GhostButton onClick={() => navigate(`/editor/${project.id}`)}>Open classic editor</GhostButton>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
