import type { ToolId, ToolMeta } from '../types'
import { TOOL_ICONS } from '../lib/toolIcons'

const RAIL_LABELS: Record<ToolId, string> = {
  enhance: 'Enhance',
  'background-remover': 'BG Fix',
  'object-remover': 'Erase',
  'magic-eraser': 'Magic',
  'ai-replace': 'Replace',
  'ai-filters': 'Filters',
}

export function ToolRail({
  tools,
  active,
  onSelect,
}: {
  tools: ToolMeta[]
  active: ToolId
  onSelect: (id: ToolId) => void
}) {
  return (
    <div className="w-[64px] sm:w-[76px] shrink-0 flex flex-col gap-1.5 overflow-y-auto no-scrollbar">
      {tools.map((t) => {
        const Icon = TOOL_ICONS[t.id]
        const isActive = t.id === active
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={`flex flex-col items-center gap-1 py-2.5 rounded-2xl text-[9.5px] sm:text-[10px] font-medium transition-all animate-fade-up ${
              isActive ? 'glass' : 'text-white/40 hover:text-white/70'
            }`}
          >
            <span
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all ${
                isActive ? `bg-gradient-to-br ${t.gradient} glow-violet` : 'bg-white/5'
              }`}
            >
              <Icon size={16} className="text-white" strokeWidth={2.25} />
            </span>
            <span className={isActive ? 'text-white' : ''}>{RAIL_LABELS[t.id]}</span>
          </button>
        )
      })}
    </div>
  )
}
