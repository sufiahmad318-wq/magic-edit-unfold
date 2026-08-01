export type ToolId =
  | 'enhance'
  | 'background-remover'
  | 'object-remover'
  | 'magic-eraser'
  | 'ai-replace'
  | 'ai-filters'

export interface ToolMeta {
  id: ToolId
  name: string
  short: string
  description: string
  gradient: string
}

export interface ProjectVersion {
  id: string
  dataUrl: string
  createdAt: number
  label: string
}

export interface Project {
  id: string
  name: string
  originalData: string
  currentData: string
  width: number
  height: number
  createdAt: number
  updatedAt: number
  lastTool: ToolId
  versions: ProjectVersion[]
}

export type ExportFormat = 'jpg' | 'png' | 'webp' | 'pdf'

export interface ExportRecord {
  id: string
  projectId: string
  projectName: string
  format: ExportFormat
  qualityLabel: string
  width: number
  height: number
  sizeBytes: number
  thumbnail: string
  dataUrl: string | null
  createdAt: number
}

export interface AppSettings {
  autoSaveEnabled: boolean
  lastExportFormat: ExportFormat
  lastExportQuality: string
  lastExportCompression: number
  lastWatermark: boolean
}

export const TOOLS: ToolMeta[] = [
  {
    id: 'enhance',
    name: 'AI Enhance',
    short: 'AI Enhance',
    description: 'Boost light, color and clarity in one tap',
    gradient: 'from-violet-500 to-fuchsia-500',
  },
  {
    id: 'background-remover',
    name: 'Background Remover',
    short: 'BG Remover',
    description: 'Lift your subject onto a transparent canvas',
    gradient: 'from-cyan-400 to-blue-500',
  },
  {
    id: 'object-remover',
    name: 'Object Remover',
    short: 'Object Remover',
    description: 'Paint over clutter and watch it disappear',
    gradient: 'from-amber-400 to-orange-500',
  },
  {
    id: 'magic-eraser',
    name: 'Magic Eraser',
    short: 'Magic Eraser',
    description: 'Brush away blemishes and distractions instantly',
    gradient: 'from-pink-500 to-rose-500',
  },
  {
    id: 'ai-replace',
    name: 'AI Replace',
    short: 'AI Replace',
    description: 'Paint a spot and swap its color in a tap',
    gradient: 'from-emerald-400 to-teal-500',
  },
  {
    id: 'ai-filters',
    name: 'AI Filters',
    short: 'AI Filters',
    description: 'One-tap looks: vivid, warm, cool, mono and more',
    gradient: 'from-indigo-400 to-purple-500',
  },
]

// ─── Template System ────────────────────────────────────────────────────────

export type TemplateCategoryId =
  | 'portrait'
  | 'instagram'
  | 'youtube'
  | 'logo'
  | 'passport'
  | 'product'
  | 'poster'
  | 'banner'
  | 'wallpaper'
  | 'festival'

export interface TemplateCategory {
  id: TemplateCategoryId
  name: string
  emoji: string
  gradient: string
  description: string
}

export interface Template {
  id: string
  name: string
  category: TemplateCategoryId
  width: number
  height: number
  description: string
  /** Tailwind gradient classes for the preview card background */
  gradient: string
  /** Accent hex used for canvas generation */
  accentColor: string
  tags: string[]
  isPremium?: boolean
}

export interface TemplatePack {
  id: string
  name: string
  description: string
  gradient: string
  emoji: string
  templateIds: string[]
}

// ─── Asset System ────────────────────────────────────────────────────────────

export type AssetCategoryId =
  | 'stickers'
  | 'frames'
  | 'shapes'
  | 'overlays'
  | 'text-effects'
  | 'fonts'

export interface AssetCategory {
  id: AssetCategoryId
  name: string
  emoji: string
  gradient: string
}

export interface AssetItem {
  id: string
  name: string
  category: AssetCategoryId
  /** Tailwind gradient for the preview tile */
  gradient: string
  /** SVG <path> d attribute — used for shapes and stickers */
  svgPath?: string
  /** Viewbox string e.g. "0 0 24 24" */
  svgViewBox?: string
  /** CSS gradient string — used for overlays */
  cssGradient?: string
  /** Font family string — used for fonts */
  fontFamily?: string
  /** Sample text — used for text effects and fonts */
  sampleText?: string
  /** CSS text-shadow — used for text effects */
  textShadow?: string
  tags: string[]
}

// ─── Cloud / Backup ──────────────────────────────────────────────────────────

export interface BackupRecord {
  id: string
  createdAt: number
  projectCount: number
  sizeBytes: number
  label: string
}

export interface BackupSettings {
  autoBackupEnabled: boolean
  autoBackupIntervalMs: number
  lastAutoBackupAt: number | null
}
