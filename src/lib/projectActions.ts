import type { AssetItem, Template } from '../types'
import { createProject } from './storage'
import type { Project } from '../types'

const MAX_DIMENSION = 2000

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function loadImageEl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export async function createProjectFromFile(file: File): Promise<Project> {
  const dataUrl = await readFileAsDataUrl(file)
  const img = await loadImageEl(dataUrl)

  let { naturalWidth: width, naturalHeight: height } = img
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const scale = MAX_DIMENSION / Math.max(width, height)
    width = Math.round(width * scale)
    height = Math.round(height * scale)
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
  const resized = canvas.toDataURL('image/png')

  const baseName = file.name.replace(/\.[^.]+$/, '') || 'Untitled'
  return createProject(baseName, resized, width, height, 'enhance')
}

// ─── Template → Project ──────────────────────────────────────────────────────

export async function createProjectFromTemplate(
  template: Template,
  file: File | null,
): Promise<Project> {
  // Cap dimensions at MAX_DIMENSION on the long edge.
  const longEdge = Math.max(template.width, template.height)
  const scale    = longEdge > MAX_DIMENSION ? MAX_DIMENSION / longEdge : 1
  const w        = Math.round(template.width  * scale)
  const h        = Math.round(template.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width  = w
  canvas.height = h
  const ctx     = canvas.getContext('2d')!

  if (file) {
    const dataUrl   = await readFileAsDataUrl(file)
    const img       = await loadImageEl(dataUrl)
    const fillScale = Math.max(w / img.naturalWidth, h / img.naturalHeight)
    const sw        = img.naturalWidth  * fillScale
    const sh        = img.naturalHeight * fillScale
    ctx.drawImage(img, (w - sw) / 2, (h - sh) / 2, sw, sh)
  } else {
    ctx.fillStyle = '#0a0a14'
    ctx.fillRect(0, 0, w, h)
    const grad = ctx.createLinearGradient(0, 0, w, h)
    grad.addColorStop(0, hexAlpha(template.accentColor, 0.25))
    grad.addColorStop(1, hexAlpha(template.accentColor, 0.08))
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = hexAlpha(template.accentColor, 0.12)
    ctx.lineWidth   = 1
    const cols = 6
    const rows = Math.max(1, Math.round((cols * h) / w))
    for (let i = 1; i < cols; i++) {
      const x = (w / cols) * i
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke()
    }
    for (let i = 1; i < rows; i++) {
      const y = (h / rows) * i
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke()
    }
    const cs = Math.min(w, h) * 0.04
    ctx.strokeStyle = hexAlpha(template.accentColor, 0.35)
    ctx.lineWidth   = 1.5
    ctx.beginPath(); ctx.moveTo(w / 2 - cs, h / 2); ctx.lineTo(w / 2 + cs, h / 2); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(w / 2, h / 2 - cs); ctx.lineTo(w / 2, h / 2 + cs); ctx.stroke()
  }

  return createProject(template.name, canvas.toDataURL('image/png'), w, h, 'enhance')
}

// ─── Asset → Project ─────────────────────────────────────────────────────────

export async function createProjectFromAsset(asset: AssetItem, size = 800): Promise<Project> {
  const canvas = document.createElement('canvas')
  canvas.width  = size
  canvas.height = size
  const ctx     = canvas.getContext('2d')!

  if (asset.category === 'stickers' || asset.category === 'shapes') {
    await drawSvgAsset(ctx, asset, size)
  } else if (asset.category === 'frames') {
    await drawFrameAsset(ctx, asset, size)
  } else if (asset.category === 'overlays') {
    drawOverlayAsset(ctx, asset, size)
  } else if (asset.category === 'text-effects') {
    drawTextEffectAsset(ctx, asset, size)
  } else {
    drawFontAsset(ctx, asset, size)
  }

  return createProject(asset.name, canvas.toDataURL('image/png'), size, size, 'enhance')
}

// ─── Drawing helpers ──────────────────────────────────────────────────────────

async function drawSvgAsset(ctx: CanvasRenderingContext2D, asset: AssetItem, size: number) {
  if (!asset.svgPath) return
  const vb   = asset.svgViewBox ?? '0 0 24 24'
  const dim  = Math.round(size * 0.65)
  const svg  = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${dim}" height="${dim}"><path d="${asset.svgPath}" fill="white"/></svg>`
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const url  = URL.createObjectURL(blob)
  try {
    const img    = await loadImageEl(url)
    const offset = (size - dim) / 2
    ctx.drawImage(img, offset, offset, dim, dim)
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function drawFrameAsset(ctx: CanvasRenderingContext2D, asset: AssetItem, size: number) {
  if (!asset.svgPath) return
  const vb   = asset.svgViewBox ?? '0 0 100 100'
  const svg  = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${size}" height="${size}"><path d="${asset.svgPath}" fill="white" fill-rule="evenodd"/></svg>`
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const url  = URL.createObjectURL(blob)
  try {
    const img = await loadImageEl(url)
    ctx.drawImage(img, 0, 0, size, size)
  } finally {
    URL.revokeObjectURL(url)
  }
}

function drawOverlayAsset(ctx: CanvasRenderingContext2D, asset: AssetItem, size: number) {
  ctx.fillStyle = '#0a0a14'
  ctx.fillRect(0, 0, size, size)
  const grad = ctx.createLinearGradient(0, 0, size, size)
  grad.addColorStop(0,   'rgba(139,92,246,0.6)')
  grad.addColorStop(0.5, 'rgba(59,130,246,0.5)')
  grad.addColorStop(1,   'rgba(217,70,239,0.6)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  void asset // asset data available for future CSS-parsing extension
}

function drawTextEffectAsset(ctx: CanvasRenderingContext2D, asset: AssetItem, size: number) {
  ctx.fillStyle = '#0a0a14'
  ctx.fillRect(0, 0, size, size)
  ctx.font             = `bold ${Math.round(size * 0.22)}px Sora, sans-serif`
  ctx.textAlign        = 'center'
  ctx.textBaseline     = 'middle'
  ctx.shadowColor      = '#8b5cf6'
  ctx.shadowBlur       = 30
  ctx.fillStyle        = 'white'
  ctx.fillText(asset.sampleText ?? asset.name, size / 2, size / 2)
  ctx.shadowBlur = 0
}

function drawFontAsset(ctx: CanvasRenderingContext2D, asset: AssetItem, size: number) {
  ctx.fillStyle = '#0a0a14'
  ctx.fillRect(0, 0, size, size)
  ctx.font         = `bold ${Math.round(size * 0.18)}px ${asset.fontFamily ?? 'sans-serif'}`
  ctx.textAlign    = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle    = 'white'
  ctx.fillText(asset.sampleText ?? 'Aa Bb', size / 2, size / 2)
}

function hexAlpha(hex: string, alpha: number): string {
  const c = parseInt(hex.replace('#', '').padEnd(6, '0'), 16)
  return `rgba(${(c >> 16) & 255},${(c >> 8) & 255},${c & 255},${alpha})`
}
