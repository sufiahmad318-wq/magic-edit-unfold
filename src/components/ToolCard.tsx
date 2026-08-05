import { Link } from '@/lib/router-compat'
import type { ToolMeta } from '../types'
import { TOOL_ICONS } from '../lib/toolIcons'

export function ToolCard({ tool, to }: { tool: ToolMeta; to: string }) {
  const Icon = TOOL_ICONS[tool.id]
  return (
    <Link
      to={to}
      className="glass rounded-2xl p-4 h-full flex flex-col gap-3 hover:border-white/15 hover:bg-white/[0.06] active:scale-[0.97] transition-all duration-200 focus-ring animate-fade-up"
    >
      <div className={`w-11 h-11 shrink-0 rounded-xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center shadow-lg`}>
        <Icon size={20} className="text-white" strokeWidth={2.25} />
      </div>
      <div className="min-w-0">
        <p className="font-display font-semibold text-sm">{tool.name}</p>
        <p className="text-xs text-white/50 mt-1 leading-snug">{tool.description}</p>
      </div>

    </Link>
  )
}
