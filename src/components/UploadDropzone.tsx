import { useRef, useState } from 'react'
import { UploadCloud } from 'lucide-react'
import { Spinner } from './Loaders'
import clsx from 'clsx'
import { toast } from 'sonner'

export function UploadDropzone({
  onFile,
  compact,
  busy,
  busyLabel = 'Preparing your photo\u2026',
}: {
  onFile: (file: File) => void
  compact?: boolean
  /** Blocks further picks and shows a spinner while the parent processes the file. */
  busy?: boolean
  busyLabel?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('That file isn\u2019t an image \u2014 pick a JPG, PNG or WebP')
      return
    }
    if (busy) return
    onFile(file)
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
      onClick={() => !busy && inputRef.current?.click()}
      className={clsx(
        'glass rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition-colors',
        dragging ? 'border-violet-400 bg-violet-500/5' : 'border-white/10 hover:border-white/20',
        compact ? 'py-8 px-4' : 'py-14 px-6',
        busy && 'pointer-events-none opacity-70',
      )}
      aria-busy={busy}
    >
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center mb-3 glow-violet">
        {busy ? <Spinner className="w-5 h-5" /> : <UploadCloud size={22} className="text-white" />}
      </div>
      <p className="font-medium text-sm">{busy ? busyLabel : 'Tap to upload a photo'}</p>
      <p className="text-xs text-white/45 mt-1">
        {busy ? 'Hang tight \u2014 this only takes a moment' : 'or drag and drop \u00b7 JPG, PNG, WebP'}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={busy}
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  )
}
