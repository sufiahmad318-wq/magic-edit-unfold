import { cloneCanvas } from './imageEffects'

export interface CropRect {
  /** all values are 0..1 fractions of the source canvas */
  x: number
  y: number
  w: number
  h: number
}

export function cropCanvas(source: HTMLCanvasElement, rect: CropRect): HTMLCanvasElement {
  const sx = Math.round(Math.max(0, rect.x) * source.width)
  const sy = Math.round(Math.max(0, rect.y) * source.height)
  const sw = Math.max(1, Math.round(Math.min(1 - rect.x, rect.w) * source.width))
  const sh = Math.max(1, Math.round(Math.min(1 - rect.y, rect.h) * source.height))
  const out = document.createElement('canvas')
  out.width = sw
  out.height = sh
  const ctx = out.getContext('2d')!
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh)
  return out
}

export interface TextOverlay {
  text: string
  /** fraction of canvas width/height for the text centre */
  x: number
  y: number
  /** font size as a fraction of canvas height */
  size: number
  color: string
  weight: number
  family: string
  shadow: boolean
}

export function drawText(source: HTMLCanvasElement, overlay: TextOverlay): HTMLCanvasElement {
  const out = cloneCanvas(source)
  const ctx = out.getContext('2d')!
  const px = Math.max(8, overlay.size * out.height)
  ctx.font = `${overlay.weight} ${px}px ${overlay.family}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (overlay.shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.55)'
    ctx.shadowBlur = px * 0.25
    ctx.shadowOffsetY = px * 0.06
  }
  ctx.fillStyle = overlay.color
  ctx.fillText(overlay.text, overlay.x * out.width, overlay.y * out.height)
  return out
}

export interface StickerOverlay {
  glyph: string
  x: number
  y: number
  /** fraction of canvas height */
  size: number
  rotation: number
}

export function drawSticker(source: HTMLCanvasElement, overlay: StickerOverlay): HTMLCanvasElement {
  const out = cloneCanvas(source)
  const ctx = out.getContext('2d')!
  const px = Math.max(12, overlay.size * out.height)
  ctx.save()
  ctx.translate(overlay.x * out.width, overlay.y * out.height)
  ctx.rotate((overlay.rotation * Math.PI) / 180)
  ctx.font = `${px}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(overlay.glyph, 0, 0)
  ctx.restore()
  return out
}

export const ASPECT_PRESETS: { id: string; label: string; ratio: number | null }[] = [
  { id: 'free', label: 'Free', ratio: null },
  { id: '1-1', label: '1:1', ratio: 1 },
  { id: '4-5', label: '4:5', ratio: 4 / 5 },
  { id: '3-2', label: '3:2', ratio: 3 / 2 },
  { id: '16-9', label: '16:9', ratio: 16 / 9 },
  { id: '9-16', label: '9:16', ratio: 9 / 16 },
]

export const STICKERS = [
  '✨', '💜', '🔥', '⭐', '🌈', '💫', '🎨', '📸', '🌸', '☀️',
  '🌙', '⚡', '🍃', '💎', '🎯', '🖤', '👑', '🦋', '🫧', '🎉',
]

export const FONT_FAMILIES = [
  { id: 'Sora, sans-serif', label: 'Sora' },
  { id: 'Inter, sans-serif', label: 'Inter' },
  { id: 'Georgia, serif', label: 'Serif' },
  { id: 'ui-monospace, monospace', label: 'Mono' },
]

/** High-quality resample to explicit pixel dimensions. */
export function resizeCanvas(source: HTMLCanvasElement, width: number, height: number): HTMLCanvasElement {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, w, h)
  return out
}

export const RESIZE_PRESETS: { id: string; label: string; w: number; h: number }[] = [
  { id: 'ig-post', label: 'IG Post', w: 1080, h: 1080 },
  { id: 'ig-story', label: 'IG Story', w: 1080, h: 1920 },
  { id: 'yt-thumb', label: 'YT Thumb', w: 1280, h: 720 },
  { id: 'fb-cover', label: 'FB Cover', w: 1640, h: 856 },
  { id: 'a4', label: 'A4 @150', w: 1240, h: 1754 },
  { id: 'hd', label: 'HD', w: 1920, h: 1080 },
]

export const DRAW_COLORS = ['#ffffff', '#0a0a12', '#60a5fa', '#a78bfa', '#f472b6', '#fbbf24', '#34d399', '#f87171']

/** Merges a transparent paint layer down onto the base image. */
export function flattenLayer(source: HTMLCanvasElement, layer: HTMLCanvasElement): HTMLCanvasElement {
  const out = cloneCanvas(source)
  out.getContext('2d')!.drawImage(layer, 0, 0)
  return out
}
