import type { ExportFormat } from '../types'
import { cloneCanvas } from './imageEffects'
import { canvasToPdfBlob } from './pdfExport'

export interface ResolutionPreset {
  id: string
  label: string
  sublabel: string
  longEdge: number | null // null = use the image's native resolution
}

export const RESOLUTION_PRESETS: ResolutionPreset[] = [
  { id: 'standard', label: 'Standard', sublabel: 'Fast & light', longEdge: 1280 },
  { id: 'hd', label: 'HD', sublabel: '1080p', longEdge: 1920 },
  { id: '2k', label: '2K', sublabel: 'Sharp detail', longEdge: 2560 },
  { id: '4k', label: '4K', sublabel: 'Maximum detail', longEdge: 3840 },
  { id: 'original', label: 'Original', sublabel: 'Native resolution', longEdge: null },
]

export const FORMAT_META: Record<ExportFormat, { label: string; mime: string; ext: string; supportsAlpha: boolean; supportsCompression: boolean }> = {
  jpg: { label: 'JPG', mime: 'image/jpeg', ext: 'jpg', supportsAlpha: false, supportsCompression: true },
  png: { label: 'PNG', mime: 'image/png', ext: 'png', supportsAlpha: true, supportsCompression: false },
  webp: { label: 'WEBP', mime: 'image/webp', ext: 'webp', supportsAlpha: true, supportsCompression: true },
  pdf: { label: 'PDF', mime: 'application/pdf', ext: 'pdf', supportsAlpha: false, supportsCompression: true },
}

export function resolveExportDimensions(width: number, height: number, presetId: string): { width: number; height: number } {
  const preset = RESOLUTION_PRESETS.find((p) => p.id === presetId)
  if (!preset || preset.longEdge === null) return { width, height }
  const longEdge = Math.max(width, height)
  const scale = preset.longEdge / longEdge
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

export interface ExportOptions {
  format: ExportFormat
  resolutionId: string
  compression: number // 0..100, applies to jpg/webp/pdf
  transparentBackground: boolean // only meaningful for png
  watermark: boolean
}

function drawWatermark(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const pad = Math.max(10, Math.round(w * 0.02))
  const fontSize = Math.max(11, Math.round(w * 0.02))
  const label = 'Magic Edit AI'
  ctx.save()
  ctx.font = `600 ${fontSize}px Sora, ui-sans-serif, system-ui, sans-serif`
  const textWidth = ctx.measureText(label).width
  const dotSize = fontSize * 0.55
  const pillW = textWidth + dotSize + pad * 2.4
  const pillH = fontSize + pad * 1.1
  const x = w - pillW - pad
  const y = h - pillH - pad
  const radius = pillH / 2

  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + pillW, y, x + pillW, y + pillH, radius)
  ctx.arcTo(x + pillW, y + pillH, x, y + pillH, radius)
  ctx.arcTo(x, y + pillH, x, y, radius)
  ctx.arcTo(x, y, x + pillW, y, radius)
  ctx.closePath()
  ctx.fillStyle = 'rgba(10, 10, 18, 0.55)'
  ctx.fill()

  const dotX = x + pad * 1.2 + dotSize / 2
  const dotY = y + pillH / 2
  const grad = ctx.createLinearGradient(dotX - dotSize, dotY - dotSize, dotX + dotSize, dotY + dotSize)
  grad.addColorStop(0, '#60a5fa')
  grad.addColorStop(1, '#c084fc')
  ctx.fillStyle = grad
  ctx.beginPath()
  ctx.arc(dotX, dotY, dotSize / 2, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, dotX + dotSize / 2 + pad * 0.5, dotY + fontSize * 0.06)
  ctx.restore()
}

/** Builds the final pixel-accurate canvas for a given set of export options. Same
 * function backs both the live size estimate and the real export, so the estimate
 * is always exact rather than guessed. */
export function buildExportCanvas(source: HTMLCanvasElement, options: ExportOptions): HTMLCanvasElement {
  const meta = FORMAT_META[options.format]
  const { width, height } = resolveExportDimensions(source.width, source.height, options.resolutionId)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!

  const wantsTransparency = options.format === 'png' && options.transparentBackground
  if (!wantsTransparency) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
  }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, width, height)

  if (options.watermark) drawWatermark(ctx, width, height)

  void meta
  return canvas
}

export interface EncodedExport {
  blob: Blob
  dataUrl: string
  width: number
  height: number
  sizeBytes: number
  mime: string
  ext: string
}

function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Encoding failed'))),
      mime,
      quality,
    )
  })
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export async function encodeExport(source: HTMLCanvasElement, options: ExportOptions): Promise<EncodedExport> {
  const canvas = buildExportCanvas(source, options)
  const meta = FORMAT_META[options.format]
  const quality = Math.min(1, Math.max(0.05, options.compression / 100))

  let blob: Blob
  if (options.format === 'pdf') {
    blob = await canvasToPdfBlob(canvas, quality)
  } else if (meta.supportsCompression) {
    blob = await canvasToBlob(canvas, meta.mime, quality)
  } else {
    blob = await canvasToBlob(canvas, meta.mime)
  }

  const dataUrl = await blobToDataUrl(blob)
  return {
    blob,
    dataUrl,
    width: canvas.width,
    height: canvas.height,
    sizeBytes: blob.size,
    mime: meta.mime,
    ext: meta.ext,
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function cloneForExport(source: HTMLCanvasElement): HTMLCanvasElement {
  return cloneCanvas(source)
}
