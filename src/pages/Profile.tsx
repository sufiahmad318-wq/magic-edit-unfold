import { useEffect, useState } from 'react'
import { useNavigate } from '@/lib/router-compat'
import { Trash2, Info, HardDrive, Sparkles, CloudUpload, ChevronRight } from 'lucide-react'
import { AnimatedLogo } from '../components/AnimatedLogo'
import { loadProjects, storageBytesUsed, clearAllData } from '../lib/storage'
import { listLocalBackups, timeAgo } from '../lib/cloudStorage'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function Profile() {
  const navigate = useNavigate()
  const [count,      setCount]      = useState(0)
  const [bytes,      setBytes]      = useState(0)
  const [confirming, setConfirming] = useState(false)
  const [lastBackup, setLastBackup] = useState<string | null>(null)

  useEffect(() => {
    setCount(loadProjects().length)
    setBytes(storageBytesUsed())
    const backups = listLocalBackups()
    setLastBackup(backups.length > 0 ? timeAgo(backups[0].createdAt) : null)
  }, [])

  const handleClear = () => {
    clearAllData()
    setCount(0)
    setBytes(0)
    setConfirming(false)
  }

  return (
    <div className="pb-28 pt-6 px-5">
      {/* ── Header ── */}
      <div className="flex items-center gap-4 animate-fade-up">
        <AnimatedLogo size="lg" />
        <div>
          <h1 className="font-display text-xl font-bold">
            <span className="aurora-text">Magic Edit</span> AI
          </h1>
          <p className="text-xs text-white/45 mt-0.5">Local, on-device photo editor</p>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 gap-3 mt-8">
        <div className="glass rounded-2xl p-4 animate-fade-up delay-1">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center mb-3">
            <Sparkles size={16} className="text-white" />
          </div>
          <p className="text-2xl font-display font-bold">{count}</p>
          <p className="text-xs text-white/45 mt-0.5">Projects</p>
        </div>
        <div className="glass rounded-2xl p-4 animate-fade-up delay-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center mb-3">
            <HardDrive size={16} className="text-white" />
          </div>
          <p className="text-2xl font-display font-bold">{formatBytes(bytes)}</p>
          <p className="text-xs text-white/45 mt-0.5">Storage used</p>
        </div>
      </div>

      {/* ── Cloud Backup shortcut ── */}
      <div className="mt-6 animate-fade-up delay-2">
        <h2 className="font-display font-semibold text-base mb-3">Backup & Sync</h2>
        <button
          onClick={() => navigate('/cloud')}
          className="w-full glass rounded-2xl p-4 flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shrink-0">
            <CloudUpload size={16} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Backup & Restore</p>
            <p className="text-xs text-white/40 mt-0.5">
              {lastBackup ? `Last backup ${lastBackup}` : 'No backup yet — tap to set up'}
            </p>
          </div>
          <ChevronRight size={16} className="text-white/30 shrink-0" />
        </button>
      </div>

      {/* ── About ── */}
      <div className="mt-6 animate-fade-up delay-3">
        <h2 className="font-display font-semibold text-base mb-3">About</h2>
        <div className="glass rounded-2xl p-4 flex items-start gap-3">
          <Info size={18} className="text-white/50 mt-0.5 shrink-0" />
          <p className="text-sm text-white/60 leading-relaxed">
            Magic Edit AI runs entirely in your browser &mdash; photos and edits are stored only on this
            device, never uploaded anywhere.
          </p>
        </div>
      </div>

      {/* ── Data ── */}
      <div className="mt-6 animate-fade-up delay-4">
        <h2 className="font-display font-semibold text-base mb-3">Data</h2>
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            disabled={count === 0}
            className="w-full glass rounded-2xl p-4 flex items-center gap-3 text-left text-red-400 disabled:text-white/30 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
          >
            <Trash2 size={18} />
            <span className="text-sm font-medium">Clear all projects</span>
          </button>
        ) : (
          <div className="glass rounded-2xl p-4">
            <p className="text-sm text-white/70 mb-3">
              This permanently deletes all {count} project{count === 1 ? '' : 's'} from this device. This can&apos;t be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 text-sm font-medium active:scale-[0.98] transition-transform"
              >
                Cancel
              </button>
              <button
                onClick={handleClear}
                className="flex-1 py-2.5 rounded-xl bg-red-500/90 text-sm font-medium active:scale-[0.98] transition-transform"
              >
                Delete all
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
