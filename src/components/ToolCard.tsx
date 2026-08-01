import { Link } from '@/lib/router-compat'
import type { ToolMeta } from '../types'
import { TOOL_ICONS } from '../lib/toolIcons'

export function ToolCard({ tool, to }: { tool: ToolMeta; to: string }) {
  const Icon = TOOL_ICONS[tool.id]
  return (
    <Link
      to={to}
      className="glass rounded-2xl p-4 flex flex-col gap-3 active:scale-[0.97] transition-transform animate-fade-up"
    >
      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center shadow-lg`}>
        <Icon size={20} className="text-white" strokeWidth={2.25} />
      </div>
      <div>
        <p className="font-display font-semibold text-sm">{tool.name}</p>
        <p className="text-xs text-white/50 mt-1 leading-snug">{tool.description}</p>
      </div>
    </Link>
  )
}
