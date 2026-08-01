import { Sparkles, Scissors, Eraser, Wand, Replace, Palette } from 'lucide-react'
import type { ToolId } from '../types'

export const TOOL_ICONS: Record<ToolId, typeof Sparkles> = {
  enhance: Sparkles,
  'background-remover': Scissors,
  'object-remover': Eraser,
  'magic-eraser': Wand,
  'ai-replace': Replace,
  'ai-filters': Palette,
}
