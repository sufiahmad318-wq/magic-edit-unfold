// SSR-safe localStorage facade. Route components are server-rendered first, so a
// bare `localStorage.getItem` during render throws "localStorage is not defined"
// and forces the whole route to fall back to client rendering.

const memory = new Map<string, string>()

const hasWindow = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'

export const ls = {
  getItem(key: string): string | null {
    if (!hasWindow()) return memory.get(key) ?? null
    return window.localStorage.getItem(key)
  },
  setItem(key: string, value: string): void {
    if (!hasWindow()) {
      memory.set(key, value)
      return
    }
    window.localStorage.setItem(key, value)
  },
  removeItem(key: string): void {
    if (!hasWindow()) {
      memory.delete(key)
      return
    }
    window.localStorage.removeItem(key)
  },
}
