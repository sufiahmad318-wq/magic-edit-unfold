import { useEffect, useState } from 'react'
import { useNavigate, useParams } from '@/lib/router-compat'
import { ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { TopBar } from '../components/TopBar'
import { UploadDropzone } from '../components/UploadDropzone'
import { ToolCard } from '../components/ToolCard'
import { TOOLS } from '../types'
import type { Project } from '../types'
import { createProjectFromFile } from '../lib/projectActions'
import { loadProjects } from '../lib/storage'
import { TOOL_ICONS } from '../lib/toolIcons'

export function Tools() {
  const navigate = useNavigate()
  const { toolId } = useParams()
  const activeTool = TOOLS.find((t) => t.id === toolId)
  const [busy, setBusy] = useState(false)
  const [recent, setRecent] = useState<Project[]>([])

  useEffect(() => {
    try {
      setRecent(loadProjects().slice(0, 6))
    } catch {
      setRecent([])
    }
  }, [])

  const handleUpload = async (file: File) => {
    if (busy) return
    setBusy(true)
    try {
      const project = await createProjectFromFile(file)
      navigate(`/editor/${project.id}?tool=${activeTool?.id ?? 'enhance'}`)
    } catch {
      toast.error('We couldn\u2019t open that image. Try a JPG or PNG.')
    } finally {
      setBusy(false)
    }
  }

  // Unknown tool id in the URL — keep the state honest instead of rendering an
  // upload flow that leads nowhere.
  if (toolId && !activeTool) {
    return (
      <div className="pb-28">
        <TopBar title="Tool not found" subtitle={'That tool does not exist'} onBack />
        <div className="px-5 mt-2">
          <div className="glass rounded-2xl py-12 px-6 text-center animate-fade-up">
            <p className="text-sm text-white/60">We couldn&rsquo;t find that tool.</p>
            <button
              onClick={() => navigate('/tools')}
              className="mt-4 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 text-sm font-semibold active:scale-95 transition-transform"
            >
              Browse all tools
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (activeTool) {
    const Icon = TOOL_ICONS[activeTool.id]
    return (
      <div className="pb-28">
        <TopBar title={activeTool.name} subtitle={activeTool.description} onBack />
        <div className="px-5 mt-2 space-y-5">
          <div className="glass rounded-2xl p-4 flex items-center gap-3 animate-fade-up">
            <span className={`w-11 h-11 shrink-0 rounded-xl bg-gradient-to-br ${activeTool.gradient} flex items-center justify-center shadow-lg`}>
              <Icon size={20} className="text-white" strokeWidth={2.25} />
            </span>
            <p className="text-xs text-white/55 leading-snug">
              Runs entirely on your device &mdash; your photo never leaves it.
            </p>
          </div>

          <UploadDropzone onFile={handleUpload} busy={busy} />

          {recent.length > 0 && (
            <div>
              <p className="text-xs text-white/40 mb-2">Or use a recent project</p>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                {recent.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/editor/${p.id}?tool=${activeTool.id}`)}
                    title={p.name}
                    className="rounded-xl overflow-hidden aspect-square ring-1 ring-white/10 hover:ring-violet-400/60 active:scale-95 transition-all focus-ring"
                  >
                    {p.currentData ? (
                      <img src={p.currentData} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="w-full h-full flex items-center justify-center bg-white/5">
                        <ImageIcon size={16} className="text-white/40" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="pb-28">
      <TopBar title="AI Tools" subtitle="Pick a tool to start editing" />
      <div className="px-5 grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2 items-stretch auto-rows-fr">
        {TOOLS.map((tool) => (
          <ToolCard key={tool.id} tool={tool} to={`/tools/${tool.id}`} />
        ))}
      </div>
    </div>
  )
}
