import { useState, useEffect } from 'react'
import { CloudUpload, Download, FolderOpen, Trash2, RefreshCw, Shield, Wifi, X } from 'lucide-react'
import { TopBar } from '../components/TopBar'
import {
  getBackupSettings,
  updateBackupSettings,
  createLocalBackup,
  listLocalBackups,
  deleteLocalBackup,
  restoreFromLocalBackup,
  downloadProjectsBundle,
  importProjectsBundle,
  formatBackupSize,
  timeAgo,
} from '../lib/cloudStorage'
import { loadProjects } from '../lib/storage'
import type { BackupRecord } from '../types'

export function Cloud() {
  const [settings,   setSettings]   = useState(() => getBackupSettings())
  const [backups,    setBackups]     = useState<BackupRecord[]>(() => listLocalBackups())
  const [projectCnt, setProjectCnt] = useState(() => loadProjects().length)
  const [busy,       setBusy]       = useState<string | null>(null)
  const [toast,      setToast]      = useState<string | null>(null)
  const [restoring,  setRestoring]  = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  const showToast = (msg: string) => setToast(msg)

  const handleBackupNow = () => {
    if (projectCnt === 0) { showToast('No projects to back up yet.'); return }
    setBusy('backup')
    setTimeout(() => {
      const rec = createLocalBackup('Manual backup')
      setBusy(null)
      if (rec) {
        setBackups(listLocalBackups())
        showToast(`Backed up ${rec.projectCount} project${rec.projectCount === 1 ? '' : 's'}.`)
      } else {
        showToast('Not enough storage for backup. Try freeing up space.')
      }
    }, 600)
  }

  const handleToggleAuto = () => {
    const next = updateBackupSettings({ autoBackupEnabled: !settings.autoBackupEnabled })
    setSettings(next)
  }

  const handleDownload = () => {
    if (projectCnt === 0) { showToast('No projects to export.'); return }
    setBusy('download')
    setTimeout(() => {
      downloadProjectsBundle()
      setBusy(null)
      showToast('Backup file downloaded.')
    }, 400)
  }

  const handleImport = async (file: File) => {
    if (!file) return
    setBusy('import')
    const result = await importProjectsBundle(file)
    setBusy(null)
    setProjectCnt(loadProjects().length)
    if (result.errors.length) {
      showToast(`Import error: ${result.errors[0]}`)
    } else {
      showToast(`Imported ${result.imported} project${result.imported === 1 ? '' : 's'}.`)
    }
  }

  const handleDeleteBackup = (id: string) => {
    deleteLocalBackup(id)
    setBackups(listLocalBackups())
  }

  const handleRestoreBackup = (id: string) => {
    setRestoring(id)
    setTimeout(() => {
      const projects = restoreFromLocalBackup(id)
      setRestoring(null)
      if (projects) {
        setProjectCnt(loadProjects().length)
        showToast(`Restored ${projects.length} project${projects.length === 1 ? '' : 's'}.`)
      } else {
        showToast('Restore failed — backup data may be corrupted.')
      }
    }, 600)
  }

  return (
    <div className="pb-32">
      <TopBar title="Backup & Sync" subtitle="Keep your work safe" onBack />

      {/* ── Status hero ── */}
      <div className="px-5 mb-5 animate-fade-up">
        <div className="glass rounded-3xl p-5">
          <div className="flex items-center gap-4">
            <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center shrink-0">
              <CloudUpload size={22} className="text-white" />
              <span className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-[#07070f] ${settings.autoBackupEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-white/30'}`} />
            </div>
            <div className="flex-1">
              <p className="font-display font-bold">Device Backup</p>
              <p className="text-xs text-white/50 mt-0.5">
                {backups.length > 0
                  ? `Last backup ${timeAgo(backups[0].createdAt)}`
                  : 'No backup yet'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-display font-bold">{projectCnt}</p>
              <p className="text-xs text-white/40">projects</p>
            </div>
          </div>

          {/* Quick stats row */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <Stat label="Backups" value={String(backups.length)} />
            <Stat label="Status" value={settings.autoBackupEnabled ? 'Auto' : 'Manual'} accent />
            <Stat
              label="Saved"
              value={backups.length > 0 ? formatBackupSize(backups.reduce((s, b) => s + b.sizeBytes, 0)) : '—'}
            />
          </div>
        </div>
      </div>

      {/* ── Primary actions ── */}
      <div className="px-5 mb-5 grid grid-cols-2 gap-3 animate-fade-up delay-1">
        <ActionButton
          icon={CloudUpload}
          label="Backup Now"
          description="Save to this device"
          gradient="from-blue-500 to-violet-500"
          loading={busy === 'backup'}
          onClick={handleBackupNow}
          primary
        />
        <ActionButton
          icon={Download}
          label="Export File"
          description="Download .json bundle"
          gradient="from-emerald-500 to-teal-500"
          loading={busy === 'download'}
          onClick={handleDownload}
        />
      </div>

      {/* ── Auto Backup ── */}
      <div className="px-5 mb-5 animate-fade-up delay-2">
        <div className="glass rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shrink-0">
            <RefreshCw size={16} className={settings.autoBackupEnabled ? 'animate-spin-slow' : ''} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Auto Backup</p>
            <p className="text-xs text-white/45 mt-0.5">Backup automatically every 30 minutes</p>
          </div>
          <button
            onClick={handleToggleAuto}
            className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${settings.autoBackupEnabled ? 'bg-violet-500' : 'bg-white/15'}`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${settings.autoBackupEnabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`}
            />
          </button>
        </div>
      </div>

      {/* ── Restore from file ── */}
      <div className="px-5 mb-5 animate-fade-up delay-2">
        <label className={`glass rounded-2xl p-4 flex items-center gap-3 cursor-pointer active:scale-[0.98] transition-transform ${busy === 'import' ? 'opacity-60 pointer-events-none' : ''}`}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shrink-0">
            <FolderOpen size={16} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">Restore from File</p>
            <p className="text-xs text-white/45 mt-0.5">Import a .json backup bundle</p>
          </div>
          {busy === 'import' ? (
            <span className="w-5 h-5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
          ) : (
            <FolderOpen size={16} className="text-white/40" />
          )}
          <input
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])}
          />
        </label>
      </div>

      {/* ── Sync across devices ── */}
      <div className="px-5 mb-5 animate-fade-up delay-3">
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center shrink-0">
              <Wifi size={16} />
            </div>
            <div>
              <p className="text-sm font-semibold">Sync Across Devices</p>
              <p className="text-xs text-white/45 mt-0.5">Move your work to another device</p>
            </div>
          </div>
          <ol className="space-y-2">
            {[
              'Tap "Export File" to download a backup bundle on this device.',
              'Transfer the .json file to your other device (email, cloud drive, etc.).',
              'Open MagicEdit AI on the other device and tap "Restore from File".',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-white/8 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-xs text-white/55 leading-relaxed">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* ── Privacy note ── */}
      <div className="px-5 mb-5 animate-fade-up delay-3">
        <div className="glass rounded-2xl p-4 flex items-start gap-3">
          <Shield size={16} className="text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-xs text-white/50 leading-relaxed">
            All backups stay on your device. Nothing is ever uploaded to external servers — MagicEdit AI is 100% local and private.
          </p>
        </div>
      </div>

      {/* ── Backup history ── */}
      {backups.length > 0 && (
        <div className="px-5 animate-fade-up delay-4">
          <h3 className="text-sm font-semibold mb-3">Backup History</h3>
          <div className="space-y-2.5">
            {backups.map((b) => (
              <div key={b.id} className="glass rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/6 flex items-center justify-center shrink-0">
                  <CloudUpload size={16} className="text-white/50" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{b.label}</p>
                  <p className="text-[11px] text-white/40 mt-0.5">
                    {new Date(b.createdAt).toLocaleString()} · {b.projectCount} projects · {formatBackupSize(b.sizeBytes)}
                  </p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => handleRestoreBackup(b.id)}
                    disabled={restoring === b.id}
                    className="w-8 h-8 rounded-xl glass flex items-center justify-center text-white/60 active:scale-90 transition-transform disabled:opacity-40"
                    title="Restore this backup"
                  >
                    {restoring === b.id
                      ? <span className="w-3.5 h-3.5 rounded-full border border-white/40 border-t-white animate-spin" />
                      : <RefreshCw size={13} />}
                  </button>
                  <button
                    onClick={() => handleDeleteBackup(b.id)}
                    className="w-8 h-8 rounded-xl glass flex items-center justify-center text-white/40 active:scale-90 transition-transform"
                    title="Delete this backup"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 animate-toast-in">
          <div className="glass rounded-2xl px-4 py-3 flex items-center gap-2.5 shadow-xl max-w-xs">
            <span className="text-sm">{toast}</span>
            <button onClick={() => setToast(null)} className="text-white/40 shrink-0">
              <X size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="bg-white/4 rounded-xl p-2.5 text-center">
      <p className={`text-base font-display font-bold ${accent ? 'text-violet-400' : ''}`}>{value}</p>
      <p className="text-[10px] text-white/40 mt-0.5">{label}</p>
    </div>
  )
}

function ActionButton({
  icon: Icon, label, description, gradient, loading, onClick, primary,
}: {
  icon: React.ElementType; label: string; description: string; gradient: string
  loading: boolean; onClick: () => void; primary?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`glass rounded-2xl p-4 text-left active:scale-[0.97] transition-transform disabled:opacity-60 ${primary ? 'ring-1 ring-violet-400/30' : ''}`}
    >
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-3`}>
        {loading
          ? <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
          : <Icon size={16} className="text-white" />}
      </div>
      <p className="text-sm font-semibold">{label}</p>
      <p className="text-[11px] text-white/45 mt-0.5">{description}</p>
    </button>
  )
}
