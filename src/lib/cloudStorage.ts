import type { BackupRecord, BackupSettings, Project } from '../types'
import { loadProjects, saveProject } from './storage'

const BACKUP_SETTINGS_KEY = 'magic-edit-ai:backup-settings'
const BACKUP_INDEX_KEY    = 'magic-edit-ai:backup-index'
const BACKUP_DATA_PREFIX  = 'magic-edit-ai:backup-data:'

const MAX_LOCAL_BACKUPS = 5
const DEFAULT_INTERVAL  = 30 * 60 * 1000 // 30 minutes

// ─── Settings ────────────────────────────────────────────────────────────────

const DEFAULT_BACKUP_SETTINGS: BackupSettings = {
  autoBackupEnabled: false,
  autoBackupIntervalMs: DEFAULT_INTERVAL,
  lastAutoBackupAt: null,
}

export function getBackupSettings(): BackupSettings {
  try {
    const raw = localStorage.getItem(BACKUP_SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_BACKUP_SETTINGS }
    return { ...DEFAULT_BACKUP_SETTINGS, ...(JSON.parse(raw) as Partial<BackupSettings>) }
  } catch {
    return { ...DEFAULT_BACKUP_SETTINGS }
  }
}

export function updateBackupSettings(patch: Partial<BackupSettings>): BackupSettings {
  const next = { ...getBackupSettings(), ...patch }
  localStorage.setItem(BACKUP_SETTINGS_KEY, JSON.stringify(next))
  return next
}

// ─── Backup Index ─────────────────────────────────────────────────────────────

function loadBackupIndex(): BackupRecord[] {
  try {
    const raw = localStorage.getItem(BACKUP_INDEX_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as BackupRecord[]
    return Array.isArray(parsed) ? parsed.sort((a, b) => b.createdAt - a.createdAt) : []
  } catch {
    return []
  }
}

function saveBackupIndex(records: BackupRecord[]): void {
  try {
    localStorage.setItem(BACKUP_INDEX_KEY, JSON.stringify(records))
  } catch {
    // Non-critical — skip
  }
}

// ─── Create / Store Backup ───────────────────────────────────────────────────

export function createLocalBackup(label = 'Manual backup'): BackupRecord | null {
  const projects = loadProjects()
  if (projects.length === 0) return null

  const id        = crypto.randomUUID()
  const payload   = JSON.stringify(projects)
  const sizeBytes = new Blob([payload]).size

  try {
    localStorage.setItem(BACKUP_DATA_PREFIX + id, payload)
  } catch {
    return null // quota exceeded — silently fail
  }

  const record: BackupRecord = {
    id,
    createdAt: Date.now(),
    projectCount: projects.length,
    sizeBytes,
    label,
  }

  // Prune oldest backups to stay within MAX_LOCAL_BACKUPS
  const index = [record, ...loadBackupIndex()].slice(0, MAX_LOCAL_BACKUPS)
  const pruned = loadBackupIndex().slice(MAX_LOCAL_BACKUPS - 1)
  for (const old of pruned) {
    localStorage.removeItem(BACKUP_DATA_PREFIX + old.id)
  }
  saveBackupIndex(index)

  return record
}

export function listLocalBackups(): BackupRecord[] {
  return loadBackupIndex()
}

export function deleteLocalBackup(id: string): void {
  localStorage.removeItem(BACKUP_DATA_PREFIX + id)
  saveBackupIndex(loadBackupIndex().filter((r) => r.id !== id))
}

export function restoreFromLocalBackup(id: string): Project[] | null {
  try {
    const raw = localStorage.getItem(BACKUP_DATA_PREFIX + id)
    if (!raw) return null
    const projects = JSON.parse(raw) as Project[]
    if (!Array.isArray(projects)) return null
    for (const p of projects) saveProject(p)
    return projects
  } catch {
    return null
  }
}

// ─── Auto-backup ─────────────────────────────────────────────────────────────

/** Call on app mount: if auto-backup is on and interval has elapsed, create a backup. */
export function runAutoBackupIfDue(): void {
  const settings = getBackupSettings()
  if (!settings.autoBackupEnabled) return
  const now = Date.now()
  if (settings.lastAutoBackupAt && now - settings.lastAutoBackupAt < settings.autoBackupIntervalMs) return

  const record = createLocalBackup('Auto backup')
  if (record) {
    updateBackupSettings({ lastAutoBackupAt: now })
  }
}

// ─── Export to File ──────────────────────────────────────────────────────────

/** Triggers a browser download of all projects as a .json bundle. */
export function downloadProjectsBundle(): void {
  const projects = loadProjects()
  const payload  = JSON.stringify({ version: 1, exportedAt: Date.now(), projects }, null, 2)
  const blob     = new Blob([payload], { type: 'application/json' })
  const url      = URL.createObjectURL(blob)
  const a        = document.createElement('a')
  a.href         = url
  a.download     = `magic-edit-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

// ─── Import from File ────────────────────────────────────────────────────────

export interface ImportResult {
  imported: number
  skipped: number
  errors: string[]
}

export async function importProjectsBundle(file: File): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] }
  try {
    const text    = await file.text()
    const parsed  = JSON.parse(text)
    const arr: Project[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.projects) ? parsed.projects : []

    for (const p of arr) {
      if (!p?.id || !p?.currentData) { result.skipped++; continue }
      saveProject({ ...p, versions: Array.isArray(p.versions) ? p.versions : [] })
      result.imported++
    }
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : 'Unknown error')
  }
  return result
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function formatBackupSize(bytes: number): string {
  if (bytes < 1024)          return `${bytes} B`
  if (bytes < 1024 * 1024)   return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function timeAgo(ts: number): string {
  const diff  = Date.now() - ts
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins < 1)    return 'just now'
  if (mins < 60)   return `${mins}m ago`
  if (hours < 24)  return `${hours}h ago`
  return `${days}d ago`
}
