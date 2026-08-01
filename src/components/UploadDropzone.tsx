import { useRef, useState } from 'react'
import { UploadCloud } from 'lucide-react'
import clsx from 'clsx'

export function UploadDropzone({
  onFile,
  compact,
}: {
  onFile: (file: File) => void
  compact?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0]
    if (file && file.type.startsWith('image/')) onFile(file)
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        handleFiles(e.dataTransfer.files)
      }}
      onClick={() => inputRef.current?.click()}
      className={clsx(
        'glass rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition-colors',
        dragging ? 'border-violet-400 bg-violet-500/5' : 'border-white/10 hover:border-white/20',
        compact ? 'py-8 px-4' : 'py-14 px-6',
      )}
    >
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center mb-3 glow-violet">
        <UploadCloud size={22} className="text-white" />
      </div>
      <p className="font-medium text-sm">Tap to upload a photo</p>
      <p className="text-xs text-white/45 mt-1">or drag and drop &middot; JPG, PNG, WebP</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  )
}
