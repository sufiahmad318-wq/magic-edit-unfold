import { ls } from './safeStorage'
import type { AppSettings, ExportRecord, Project, ProjectVersion, ToolId } from '../types'

const PROJECTS_KEY = 'magic-edit-ai:projects'
const LAST_PROJECT_KEY = 'magic-edit-ai:last-project'
const DRAFT_PREFIX = 'magic-edit-ai:draft:'
const EXPORTS_KEY = 'magic-edit-ai:exports'
const SETTINGS_KEY = 'magic-edit-ai:settings'

const MAX_VERSIONS = 10
const MAX_EXPORTS = 8

function normalizeProject(p: Project): Project {
  return { ...p, versions: Array.isArray(p.versions) ? p.versions : [] }
}

export function loadProjects(): Project[] {
  try {
    const raw = ls.getItem(PROJECTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Project[]
    return Array.isArray(parsed) ? parsed.map(normalizeProject).sort((a, b) => b.updatedAt - a.updatedAt) : []
  } catch {
    return []
  }
}

function persist(projects: Project[]) {
  ls.setItem(PROJECTS_KEY, JSON.stringify(projects))
}

/** Writes JSON to localStorage, pruning array entries via `shrink` and retrying if the quota is exceeded. */
function safeWrite<T>(key: string, value: T, shrink: (value: T) => T | null): boolean {
  let current = value
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      ls.setItem(key, JSON.stringify(current))
      return true
    } catch (err) {
      if (!(err instanceof DOMException) || (err.name !== 'QuotaExceededError' && err.code !== 22)) throw err
      const smaller = shrink(current)
      if (smaller === null) return false
      current = smaller
    }
  }
  return false
}

export function saveProject(project: Project): Project[] {
  const projects = loadProjects()
  const idx = projects.findIndex((p) => p.id === project.id)
  if (idx >= 0) {
    projects[idx] = project
  } else {
    projects.push(project)
  }
  persist(projects)
  return loadProjects()
}

export function deleteProject(id: string): Project[] {
  const projects = loadProjects().filter((p) => p.id !== id)
  persist(projects)
  if (getLastProjectId() === id) clearLastProjectId()
  clearDraft(id)
  return projects
}

export function duplicateProject(id: string): Project[] {
  const projects = loadProjects()
  const source = projects.find((p) => p.id === id)
  if (!source) return projects
  const copy: Project = {
    ...source,
    id: crypto.randomUUID(),
    name: `${source.name} copy`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    versions: [],
  }
  projects.push(copy)
  persist(projects)
  return loadProjects()
}

/** "Save As": clone the current project under a new name and start it with a fresh version history. */
export function saveProjectAs(id: string, newName: string): Project | null {
  const projects = loadProjects()
  const source = projects.find((p) => p.id === id)
  if (!source) return null
  const copy: Project = {
    ...source,
    id: crypto.randomUUID(),
    name: newName.trim() || `${source.name} copy`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    versions: [],
  }
  projects.push(copy)
  persist(projects)
  setLastProjectId(copy.id)
  return copy
}

export function renameProject(id: string, name: string): Project[] {
  const projects = loadProjects()
  const target = projects.find((p) => p.id === id)
  if (target) {
    target.name = name
    target.updatedAt = Date.now()
    persist(projects)
  }
  return loadProjects()
}

export function getProject(id: string): Project | undefined {
  return loadProjects().find((p) => p.id === id)
}

export function createProject(name: string, dataUrl: string, width: number, height: number, tool: ToolId): Project {
  const project: Project = {
    id: crypto.randomUUID(),
    name,
    originalData: dataUrl,
    currentData: dataUrl,
    width,
    height,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastTool: tool,
    versions: [],
  }
  saveProject(project)
  setLastProjectId(project.id)
  return project
}

/** Appends a version snapshot for undo-safe long-term history (separate from the in-editor undo stack). */
export function addVersion(projectId: string, dataUrl: string, label: string): Project | null {
  const projects = loadProjects()
  const project = projects.find((p) => p.id === projectId)
  if (!project) return null

  const version: ProjectVersion = { id: crypto.randomUUID(), dataUrl, createdAt: Date.now(), label }
  project.versions = [version, ...project.versions].slice(0, MAX_VERSIONS)

  const ok = safeWrite(PROJECTS_KEY, projects, (list) => {
    const target = list.find((p) => p.id === projectId)
    if (target && target.versions.length > 1) {
      target.versions = target.versions.slice(0, target.versions.length - 1)
      return list
    }
    return null
  })
  if (!ok) {
    // Could not fit even a single version -- drop silently, version history is best-effort.
    project.versions = project.versions.filter((v) => v.id !== version.id)
    return project
  }
  return project
}

export function restoreVersion(projectId: string, versionId: string): Project | null {
  const projects = loadProjects()
  const project = projects.find((p) => p.id === projectId)
  const version = project?.versions.find((v) => v.id === versionId)
  if (!project || !version) return null
  project.currentData = version.dataUrl
  project.updatedAt = Date.now()
  persist(projects)
  return project
}

export function deleteVersion(projectId: string, versionId: string): Project | null {
  const projects = loadProjects()
  const project = projects.find((p) => p.id === projectId)
  if (!project) return null
  project.versions = project.versions.filter((v) => v.id !== versionId)
  persist(projects)
  return project
}

export function setLastProjectId(id: string) {
  ls.setItem(LAST_PROJECT_KEY, id)
}

export function getLastProjectId(): string | null {
  return ls.getItem(LAST_PROJECT_KEY)
}

export function clearLastProjectId() {
  ls.removeItem(LAST_PROJECT_KEY)
}

export function clearAllData() {
  const projects = loadProjects()
  ls.removeItem(PROJECTS_KEY)
  ls.removeItem(LAST_PROJECT_KEY)
  for (const p of projects) clearDraft(p.id)
}

export function storageBytesUsed(): number {
  let total = 0
  for (const key of [PROJECTS_KEY, EXPORTS_KEY, SETTINGS_KEY]) {
    total += new Blob([ls.getItem(key) || '']).size
  }
  return total
}

// --- Unsaved-draft recovery: separate from the persisted project so we never
// clobber the last explicitly saved version until the user chooses to restore. ---
export interface ProjectDraft {
  dataUrl: string
  historyItems: string[]
  historyIndex: number
  tool: ToolId
  updatedAt: number
}

export function saveDraft(projectId: string, draft: ProjectDraft) {
  try {
    ls.setItem(DRAFT_PREFIX + projectId, JSON.stringify(draft))
  } catch {
    // Drafts are best-effort; never let this crash the editor.
  }
}

export function loadDraft(projectId: string): ProjectDraft | null {
  try {
    const raw = ls.getItem(DRAFT_PREFIX + projectId)
    return raw ? (JSON.parse(raw) as ProjectDraft) : null
  } catch {
    return null
  }
}

export function clearDraft(projectId: string) {
  ls.removeItem(DRAFT_PREFIX + projectId)
}

// --- Workspace drafts: kept under a separate key so the classic editor's draft
// (which stores its own tool ids) is never clobbered by the workspace, and vice versa. ---
const WS_DRAFT_PREFIX = 'magic-edit-ai:ws-draft:'

export interface WorkspaceDraft {
  dataUrl: string
  historyItems: string[]
  historyIndex: number
  tool: string
  updatedAt: number
}

/** Returns 'ok' | 'quota' | 'error' so callers can surface an honest message. */
export function saveWorkspaceDraft(projectId: string, draft: WorkspaceDraft): 'ok' | 'quota' | 'error' {
  if (!draft.dataUrl || draft.historyItems.length === 0) return 'error'
  const key = WS_DRAFT_PREFIX + projectId
  // Trim history from the oldest side if the payload doesn't fit.
  let current: WorkspaceDraft = draft
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      ls.setItem(key, JSON.stringify(current))
      return 'ok'
    } catch (err) {
      const quota = err instanceof DOMException && (err.name === 'QuotaExceededError' || err.code === 22)
      if (!quota) return 'error'
      if (current.historyItems.length <= 1) {
        try {
          ls.setItem(key, JSON.stringify({ ...current, historyItems: [current.dataUrl], historyIndex: 0 }))
          return 'ok'
        } catch {
          return 'quota'
        }
      }
      const items = current.historyItems.slice(1)
      current = { ...current, historyItems: items, historyIndex: Math.max(0, current.historyIndex - 1) }
    }
  }
  return 'quota'
}

export function loadWorkspaceDraft(projectId: string): WorkspaceDraft | null {
  try {
    const raw = ls.getItem(WS_DRAFT_PREFIX + projectId)
    if (!raw) return null
    const parsed = JSON.parse(raw) as WorkspaceDraft
    if (!parsed?.dataUrl || !Array.isArray(parsed.historyItems) || parsed.historyItems.length === 0) return null
    return parsed
  } catch {
    return null
  }
}

export function clearWorkspaceDraft(projectId: string) {
  ls.removeItem(WS_DRAFT_PREFIX + projectId)
}


// --- App-wide settings (auto-save, remembered export preferences) ---
const DEFAULT_SETTINGS: AppSettings = {
  autoSaveEnabled: true,
  lastExportFormat: 'png',
  lastExportQuality: 'original',
  lastExportCompression: 90,
  lastWatermark: false,
}

export function getSettings(): AppSettings {
  try {
    const raw = ls.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  const next = { ...getSettings(), ...patch }
  ls.setItem(SETTINGS_KEY, JSON.stringify(next))
  return next
}

// --- Recent exports ---
export function loadExportRecords(): ExportRecord[] {
  try {
    const raw = ls.getItem(EXPORTS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ExportRecord[]
    return Array.isArray(parsed) ? parsed.sort((a, b) => b.createdAt - a.createdAt) : []
  } catch {
    return []
  }
}

export function addExportRecord(record: ExportRecord): ExportRecord[] {
  const records = [record, ...loadExportRecords()].slice(0, MAX_EXPORTS)
  const ok = safeWrite(EXPORTS_KEY, records, (list) => {
    // First drop the heaviest payload (the full export data URL) from the oldest entries,
    // then start removing whole entries if it's still too big.
    const withData = list.filter((r) => r.dataUrl)
    if (withData.length > 0) {
      const oldest = withData[withData.length - 1]
      oldest.dataUrl = null
      return list
    }
    if (list.length > 1) return list.slice(0, list.length - 1)
    return null
  })
  return ok ? loadExportRecords() : loadExportRecords()
}

export function deleteExportRecord(id: string): ExportRecord[] {
  const records = loadExportRecords().filter((r) => r.id !== id)
  ls.setItem(EXPORTS_KEY, JSON.stringify(records))
  return records
}

export function clearExportRecords() {
  ls.removeItem(EXPORTS_KEY)
}
