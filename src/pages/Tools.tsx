import { useState } from 'react'
import { useNavigate, useParams } from '@/lib/router-compat'
import { TopBar } from '../components/TopBar'
import { UploadDropzone } from '../components/UploadDropzone'
import { ToolCard } from '../components/ToolCard'
import { TOOLS } from '../types'
import { createProjectFromFile } from '../lib/projectActions'

export function Tools() {
  const navigate = useNavigate()
  const { toolId } = useParams()
  const activeTool = TOOLS.find((t) => t.id === toolId)
  const [busy, setBusy] = useState(false)

  const handleUpload = async (file: File) => {
    setBusy(true)
    try {
      const project = await createProjectFromFile(file)
      navigate(`/editor/${project.id}?tool=${activeTool?.id ?? 'enhance'}`)
    } finally {
      setBusy(false)
    }
  }

  if (activeTool) {
    return (
      <div className="pb-28">
        <TopBar title={activeTool.name} subtitle={activeTool.description} onBack />
        <div className="px-5 mt-2">
          {busy ? (
            <div className="glass rounded-2xl py-14 text-center text-sm text-white/60">Preparing your photo…</div>
          ) : (
            <UploadDropzone onFile={handleUpload} />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="pb-28">
      <TopBar title="AI Tools" subtitle="Pick a tool to start editing" />
      <div className="px-5 grid grid-cols-2 gap-3 mt-2">
        {TOOLS.map((tool) => (
          <ToolCard key={tool.id} tool={tool} to={`/tools/${tool.id}`} />
        ))}
      </div>
    </div>
  )
}
