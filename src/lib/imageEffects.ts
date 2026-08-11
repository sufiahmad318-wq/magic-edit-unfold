// Real, self-contained canvas algorithms -- no network calls, no fake outputs.
// "Enhance" adjusts real pixel values. Background removal uses corner-sampled
// chroma distance. Object/magic-eraser removal uses iterative diffusion
// inpainting seeded from the ring of pixels around the masked region.

export interface EnhanceSettings {
  brightness: number // -100..100
  contrast: number // -100..100
  saturation: number // -100..100
  sharpen: number // 0..100
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export function canvasFromImage(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  return canvas
}

export function cloneCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = source.width
  canvas.height = source.height
  canvas.getContext('2d')!.drawImage(source, 0, 0)
  return canvas
}

export function applyEnhance(source: HTMLCanvasElement, settings: EnhanceSettings): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = source.width
  out.height = source.height
  const ctx = out.getContext('2d')!

  const brightness = 1 + settings.brightness / 100
  const contrast = 1 + settings.contrast / 100
  const saturate = 1 + settings.saturation / 100

  ctx.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturate})`
  ctx.drawImage(source, 0, 0)
  ctx.filter = 'none'

  if (settings.sharpen > 0) {
    sharpenInPlace(ctx, out.width, out.height, settings.sharpen / 100)
  }

  return out
}

function sharpenInPlace(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number) {
  const src = ctx.getImageData(0, 0, w, h)
  const dst = ctx.createImageData(w, h)
  const s = src.data
  const d = dst.data
  const centerWeight = 1 + 4 * amount
  const edgeWeight = -amount

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      for (let c = 0; c < 3; c++) {
        const center = s[i + c]
        const up = y > 0 ? s[i - w * 4 + c] : center
        const down = y < h - 1 ? s[i + w * 4 + c] : center
        const left = x > 0 ? s[i - 4 + c] : center
        const right = x < w - 1 ? s[i + 4 + c] : center
        const value = center * centerWeight + (up + down + left + right) * edgeWeight
        d[i + c] = Math.max(0, Math.min(255, value))
      }
      d[i + 3] = s[i + 3]
    }
  }
  ctx.putImageData(dst, 0, 0)
}

export function autoEnhanceSettings(source: HTMLCanvasElement): EnhanceSettings {
  const ctx = source.getContext('2d')!
  const { data } = ctx.getImageData(0, 0, source.width, source.height)
  let sum = 0
  let min = 255
  let max = 0
  const step = 4 * 8 // sample every 8th pixel for speed
  let count = 0
  for (let i = 0; i < data.length; i += step) {
    const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    sum += luma
    min = Math.min(min, luma)
    max = Math.max(max, luma)
    count++
  }
  const avg = sum / Math.max(1, count)
  const range = Math.max(1, max - min)

  const brightness = Math.max(-30, Math.min(30, (128 - avg) * 0.4))
  const contrast = Math.max(0, Math.min(35, (100 - range) * 0.3))
  return {
    brightness: Math.round(brightness),
    contrast: Math.round(contrast + 10),
    saturation: 18,
    sharpen: 25,
  }
}

// --- Background remover: multi-cluster edge sampling + connectivity + matting ---
// Still 100% on-device (no model, no network). Improvements over the naive
// single-colour chroma key:
//  1. Border pixels are clustered into up to 3 representative background colours,
//     so gradients / uneven lighting no longer break the key.
//  2. Two thresholds produce a trimap: certain background, uncertain band, subject.
//  3. Only background *connected* to the frame is cut (flood fill), so same-coloured
//     areas inside the subject survive.
//  4. Morphological close/open removes speckles and fills small holes.
//  5. The uncertain band gets a soft alpha ramp plus a small box blur, which gives
//     feathered edges instead of a hard jagged cut.

type Rgb = [number, number, number]

function clusterBackgroundColors(data: Uint8ClampedArray, width: number, height: number): Rgb[] {
  const samples: Rgb[] = []
  const stepX = Math.max(1, Math.floor(width / 96))
  const stepY = Math.max(1, Math.floor(height / 96))
  const band = Math.max(1, Math.round(Math.min(width, height) * 0.02))

  const push = (x: number, y: number) => {
    const i = (y * width + x) * 4
    samples.push([data[i], data[i + 1], data[i + 2]])
  }
  for (let x = 0; x < width; x += stepX) {
    for (let b = 0; b < band; b++) {
      push(x, b)
      push(x, height - 1 - b)
    }
  }
  for (let y = 0; y < height; y += stepY) {
    for (let b = 0; b < band; b++) {
      push(b, y)
      push(width - 1 - b, y)
    }
  }

  // Greedy clustering: assign each sample to the nearest centroid within 48 units,
  // otherwise open a new cluster (max 3 -- more than that is not a keyable background).
  const centroids: { sum: Rgb; count: number }[] = []
  for (const s of samples) {
    let best = -1
    let bestDist = Infinity
    for (let c = 0; c < centroids.length; c++) {
      const cen = centroids[c]
      const cr = cen.sum[0] / cen.count
      const cg = cen.sum[1] / cen.count
      const cb = cen.sum[2] / cen.count
      const d = Math.hypot(s[0] - cr, s[1] - cg, s[2] - cb)
      if (d < bestDist) {
        bestDist = d
        best = c
      }
    }
    if (best >= 0 && (bestDist < 48 || centroids.length >= 3)) {
      const cen = centroids[best]
      cen.sum[0] += s[0]
      cen.sum[1] += s[1]
      cen.sum[2] += s[2]
      cen.count++
    } else {
      centroids.push({ sum: [s[0], s[1], s[2]], count: 1 })
    }
  }

  // Drop clusters that barely appear on the border -- they are usually subject pixels
  // touching the frame, and keying them would eat into the subject.
  const total = samples.length || 1
  return centroids
    .filter((c) => c.count / total > 0.05)
    .map((c) => [c.sum[0] / c.count, c.sum[1] / c.count, c.sum[2] / c.count] as Rgb)
}

/** In-place 3x3 morphological pass over a binary mask. mode 'dilate' | 'erode'. */
function morph(mask: Uint8Array, width: number, height: number, mode: 'dilate' | 'erode'): Uint8Array {
  const out = new Uint8Array(mask.length)
  const target = mode === 'dilate' ? 1 : 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x
      let hit = false
      for (let dy = -1; dy <= 1 && !hit; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          if (mask[ny * width + nx] === target) {
            hit = true
            break
          }
        }
      }
      out[p] = hit ? target : mask[p]
    }
  }
  return out
}

/** Separable box blur on an alpha channel, used to feather the cut edge. */
function blurAlpha(alpha: Float32Array, width: number, height: number, radius: number): Float32Array {
  if (radius < 1) return alpha
  const tmp = new Float32Array(alpha.length)
  const out = new Float32Array(alpha.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0
      let n = 0
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx
        if (nx < 0 || nx >= width) continue
        sum += alpha[y * width + nx]
        n++
      }
      tmp[y * width + x] = sum / n
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0
      let n = 0
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy
        if (ny < 0 || ny >= height) continue
        sum += tmp[ny * width + x]
        n++
      }
      out[y * width + x] = sum / n
    }
  }
  return out
}

export function removeBackground(source: HTMLCanvasElement, tolerance: number): HTMLCanvasElement {
  const out = cloneCanvas(source)
  const ctx = out.getContext('2d')!
  const { width, height } = out
  const imageData = ctx.getImageData(0, 0, width, height)
  const { data } = imageData

  const clusters = clusterBackgroundColors(data, width, height)
  if (clusters.length === 0) return out

  // Two thresholds: inner (certain background) and outer (uncertain edge band).
  const inner = 18 + tolerance * 0.9
  const outer = inner + 18 + tolerance * 0.5

  const dist = new Float32Array(width * height)
  const candidate = new Uint8Array(width * height) // within the outer threshold
  for (let p = 0; p < width * height; p++) {
    const i = p * 4
    let best = Infinity
    for (const [cr, cg, cb] of clusters) {
      const d = Math.hypot(data[i] - cr, data[i + 1] - cg, data[i + 2] - cb)
      if (d < best) best = d
    }
    dist[p] = best
    if (best < outer) candidate[p] = 1
  }

  // Keep only candidate background that is connected to the image frame.
  const connected = new Uint8Array(width * height)
  const stack: number[] = []
  const seedIf = (x: number, y: number) => {
    const p = y * width + x
    if (candidate[p] && !connected[p]) {
      connected[p] = 1
      stack.push(p)
    }
  }
  for (let x = 0; x < width; x++) {
    seedIf(x, 0)
    seedIf(x, height - 1)
  }
  for (let y = 0; y < height; y++) {
    seedIf(0, y)
    seedIf(width - 1, y)
  }
  while (stack.length) {
    const p = stack.pop()!
    const x = p % width
    const y = (p / width) | 0
    if (x > 0) seedIf(x - 1, y)
    if (x < width - 1) seedIf(x + 1, y)
    if (y > 0) seedIf(x, y - 1)
    if (y < height - 1) seedIf(x, y + 1)
  }

  // Cleanup: close (dilate then erode) removes pinholes in the background mask,
  // open (erode then dilate) removes isolated background specks sitting on the subject.
  let cleaned = morph(connected, width, height, 'dilate')
  cleaned = morph(cleaned, width, height, 'erode')
  cleaned = morph(cleaned, width, height, 'erode')
  cleaned = morph(cleaned, width, height, 'dilate')

  // Soft alpha: certain background -> 0, uncertain band -> ramp, subject -> 255.
  const alpha = new Float32Array(width * height)
  const span = Math.max(1, outer - inner)
  for (let p = 0; p < width * height; p++) {
    if (!cleaned[p]) {
      alpha[p] = 255
      continue
    }
    const d = dist[p]
    if (d <= inner) alpha[p] = 0
    else alpha[p] = Math.min(255, ((d - inner) / span) * 255)
  }

  const feather = Math.max(1, Math.round(Math.min(width, height) / 500))
  const softened = blurAlpha(alpha, width, height, feather)

  for (let p = 0; p < width * height; p++) {
    // Never let the blur eat into pixels that are confidently subject.
    const a = cleaned[p] ? softened[p] : Math.max(softened[p], 255)
    data[p * 4 + 3] = Math.round(Math.max(0, Math.min(255, a)) * (data[p * 4 + 3] / 255))
  }

  ctx.putImageData(imageData, 0, 0)
  return out
}


// --- Object remover / magic eraser: iterative diffusion inpainting ---
export function inpaint(source: HTMLCanvasElement, maskCanvas: HTMLCanvasElement, iterations = 220): HTMLCanvasElement {
  const out = cloneCanvas(source)
  const ctx = out.getContext('2d')!
  const { width, height } = out
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data

  const maskCtx = maskCanvas.getContext('2d')!
  const maskData = maskCtx.getImageData(0, 0, width, height).data

  const masked = new Uint8Array(width * height)
  let maskedCount = 0
  for (let p = 0; p < width * height; p++) {
    if (maskData[p * 4 + 3] > 10) {
      masked[p] = 1
      maskedCount++
    }
  }
  if (maskedCount === 0) return out

  // Seed masked pixels with the average of nearby unmasked pixels, then
  // relax with iterative averaging (Jacobi diffusion) constrained to the mask.
  const work = new Float32Array(width * height * 3)
  for (let p = 0; p < width * height; p++) {
    work[p * 3] = data[p * 4]
    work[p * 3 + 1] = data[p * 4 + 1]
    work[p * 3 + 2] = data[p * 4 + 2]
  }

  for (let p = 0; p < width * height; p++) {
    if (!masked[p]) continue
    const x = p % width
    const y = (p / width) | 0
    let sr = 0
    let sg = 0
    let sb = 0
    let n = 0
    for (let ry = -3; ry <= 3; ry++) {
      for (let rx = -3; rx <= 3; rx++) {
        const nx = x + rx
        const ny = y + ry
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const np = ny * width + nx
        if (masked[np]) continue
        sr += work[np * 3]
        sg += work[np * 3 + 1]
        sb += work[np * 3 + 2]
        n++
      }
    }
    if (n > 0) {
      work[p * 3] = sr / n
      work[p * 3 + 1] = sg / n
      work[p * 3 + 2] = sb / n
    }
  }

  const next = new Float32Array(work.length)
  for (let iter = 0; iter < iterations; iter++) {
    next.set(work)
    for (let p = 0; p < width * height; p++) {
      if (!masked[p]) continue
      const x = p % width
      const y = (p / width) | 0
      let sr = 0
      let sg = 0
      let sb = 0
      let n = 0
      const neighbors = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]
      for (const [nx, ny] of neighbors) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const np = ny * width + nx
        sr += work[np * 3]
        sg += work[np * 3 + 1]
        sb += work[np * 3 + 2]
        n++
      }
      if (n > 0) {
        next[p * 3] = sr / n
        next[p * 3 + 1] = sg / n
        next[p * 3 + 2] = sb / n
      }
    }
    work.set(next)
  }

  for (let p = 0; p < width * height; p++) {
    if (!masked[p]) continue
    data[p * 4] = work[p * 3]
    data[p * 4 + 1] = work[p * 3 + 1]
    data[p * 4 + 2] = work[p * 3 + 2]
  }

  ctx.putImageData(imageData, 0, 0)
  return out
}

export function canvasToDataUrl(canvas: HTMLCanvasElement, type = 'image/png'): string {
  return canvas.toDataURL(type, 0.95)
}

export function canvasThumbnail(source: HTMLCanvasElement, maxSize = 160): string {
  const scale = Math.min(1, maxSize / Math.max(source.width, source.height))
  const w = Math.max(1, Math.round(source.width * scale))
  const h = Math.max(1, Math.round(source.height * scale))
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  out.getContext('2d')!.drawImage(source, 0, 0, w, h)
  return out.toDataURL('image/jpeg', 0.7)
}

// --- Filters: real CSS-filter based looks, applied to actual pixels ---
export interface FilterPreset {
  id: string
  label: string
  css: string
}

export const FILTER_PRESETS: FilterPreset[] = [
  { id: 'none', label: 'None', css: 'none' },
  { id: 'vivid', label: 'Vivid', css: 'saturate(1.55) contrast(1.15) brightness(1.03)' },
  { id: 'warm', label: 'Warm', css: 'sepia(0.28) saturate(1.25) brightness(1.05) hue-rotate(-6deg)' },
  { id: 'cool', label: 'Cool', css: 'saturate(1.1) brightness(1.02) hue-rotate(12deg) contrast(1.05)' },
  { id: 'mono', label: 'Mono', css: 'grayscale(1) contrast(1.12)' },
  { id: 'fade', label: 'Fade', css: 'saturate(0.7) brightness(1.1) contrast(0.88)' },
  { id: 'dramatic', label: 'Dramatic', css: 'contrast(1.4) saturate(1.2) brightness(0.94)' },
]

export function applyFilterPreset(source: HTMLCanvasElement, css: string): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = source.width
  out.height = source.height
  const ctx = out.getContext('2d')!
  ctx.filter = css
  ctx.drawImage(source, 0, 0)
  ctx.filter = 'none'
  return out
}

// --- Color replace: recolor a brushed mask while preserving luminance ---
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const bigint = parseInt(clean, 16)
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255]
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  const d = max - min
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1))
    switch (max) {
      case r:
        h = ((g - b) / d) % 6
        break
      case g:
        h = (b - r) / d + 2
        break
      default:
        h = (r - g) / d + 4
    }
    h *= 60
    if (h < 0) h += 360
  }
  return [h, s, l]
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let [r, g, b] = [0, 0, 0]
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255]
}

export function replaceColor(source: HTMLCanvasElement, maskCanvas: HTMLCanvasElement, hex: string): HTMLCanvasElement {
  const out = cloneCanvas(source)
  const ctx = out.getContext('2d')!
  const { width, height } = out
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data
  const maskData = maskCanvas.getContext('2d')!.getImageData(0, 0, width, height).data

  const [tr, tg, tb] = hexToRgb(hex)
  const [targetHue, targetSat] = rgbToHsl(tr, tg, tb)

  for (let p = 0; p < width * height; p++) {
    const alpha = maskData[p * 4 + 3]
    if (alpha === 0) continue
    const weight = alpha / 255
    const i = p * 4
    const [, , lum] = rgbToHsl(data[i], data[i + 1], data[i + 2])
    const [nr, ng, nb] = hslToRgb(targetHue, targetSat, lum)
    data[i] = data[i] * (1 - weight) + nr * weight
    data[i + 1] = data[i + 1] * (1 - weight) + ng * weight
    data[i + 2] = data[i + 2] * (1 - weight) + nb * weight
  }

  ctx.putImageData(imageData, 0, 0)
  return out
}

/** True when the mask layer has at least one painted (non-transparent) pixel. */
export function maskHasContent(maskCanvas: HTMLCanvasElement): boolean {
  const ctx = maskCanvas.getContext('2d')
  if (!ctx || maskCanvas.width === 0 || maskCanvas.height === 0) return false
  const { data } = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height)
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 8) return true
  }
  return false
}
