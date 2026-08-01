const FAVORITES_KEY = 'magic-edit-ai:template-favorites'
const RECENTS_KEY   = 'magic-edit-ai:template-recents'
const PACKS_KEY     = 'magic-edit-ai:downloaded-packs'

const MAX_RECENTS = 12

function readStringArray(key: string): string[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as string[]) : []
  } catch {
    return []
  }
}

function writeStringArray(key: string, arr: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(arr))
  } catch {
    // Best-effort — favorites/recents are non-critical.
  }
}

// ─── Favorites ───────────────────────────────────────────────────────────────

export function getFavoriteTemplates(): string[] {
  return readStringArray(FAVORITES_KEY)
}

export function isTemplateFavorited(id: string): boolean {
  return getFavoriteTemplates().includes(id)
}

export function toggleFavoriteTemplate(id: string): boolean {
  const favs = getFavoriteTemplates()
  const idx  = favs.indexOf(id)
  if (idx >= 0) {
    favs.splice(idx, 1)
    writeStringArray(FAVORITES_KEY, favs)
    return false
  }
  favs.unshift(id)
  writeStringArray(FAVORITES_KEY, favs)
  return true
}

// ─── Recents ─────────────────────────────────────────────────────────────────

export function getRecentTemplates(): string[] {
  return readStringArray(RECENTS_KEY)
}

export function addRecentTemplate(id: string): void {
  const recents = readStringArray(RECENTS_KEY).filter((r) => r !== id)
  recents.unshift(id)
  writeStringArray(RECENTS_KEY, recents.slice(0, MAX_RECENTS))
}

// ─── Downloaded Packs ────────────────────────────────────────────────────────

export function getDownloadedPacks(): string[] {
  return readStringArray(PACKS_KEY)
}

export function markPackDownloaded(packId: string): void {
  const packs = readStringArray(PACKS_KEY)
  if (!packs.includes(packId)) {
    packs.unshift(packId)
    writeStringArray(PACKS_KEY, packs)
  }
}

export function isPackDownloaded(packId: string): boolean {
  return getDownloadedPacks().includes(packId)
}
