// Real browser-native gallery/share/open integrations -- no server, no faking.

export function dataUrlToFile(dataUrl: string, filename: string, mime: string): File {
  const [, base64] = dataUrl.split(',')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new File([bytes], filename, { type: mime })
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export function canUseFileShare(file: File): boolean {
  const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean }
  return typeof nav.share === 'function' && typeof nav.canShare === 'function' && nav.canShare({ files: [file] })
}

/** Opens the OS share sheet with the exported file. On Android this is the closest
 * web-native equivalent to "Save to Gallery" -- the sheet includes Photos/Files targets. */
export async function shareFile(file: File, title: string): Promise<'shared' | 'cancelled' | 'unsupported'> {
  const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> }
  if (!canUseFileShare(file) || !nav.share) return 'unsupported'
  try {
    await nav.share({ files: [file], title })
    return 'shared'
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
    return 'unsupported'
  }
}

export function openDataUrlInNewTab(dataUrl: string, mime: string, filename: string) {
  const file = dataUrlToFile(dataUrl, filename, mime)
  const url = URL.createObjectURL(file)
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
