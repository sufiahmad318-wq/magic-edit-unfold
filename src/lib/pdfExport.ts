// Minimal, dependency-free single-page PDF writer. Embeds a real JPEG using the
// PDF spec's native DCTDecode filter, so no external PDF library is required.

function canvasToJpegBytes(canvas: HTMLCanvasElement, quality: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          reject(new Error('Could not encode image for PDF export'))
          return
        }
        resolve(new Uint8Array(await blob.arrayBuffer()))
      },
      'image/jpeg',
      quality,
    )
  })
}

export async function canvasToPdfBlob(canvas: HTMLCanvasElement, quality = 0.9): Promise<Blob> {
  const jpegBytes = await canvasToJpegBytes(canvas, quality)
  const { width, height } = canvas

  // Treat the canvas at 96 DPI and convert to PDF points (72 per inch).
  const ptsPerPx = 72 / 96
  const pageW = Math.max(1, Math.round(width * ptsPerPx))
  const pageH = Math.max(1, Math.round(height * ptsPerPx))
  const content = `q ${pageW} 0 0 ${pageH} 0 0 cm /Im0 Do Q`

  const encoder = new TextEncoder()
  const parts: Uint8Array[] = []
  const offsets: number[] = []
  let pos = 0

  const pushText = (s: string) => {
    const bytes = encoder.encode(s)
    parts.push(bytes)
    pos += bytes.length
  }
  const pushBytes = (bytes: Uint8Array) => {
    parts.push(bytes)
    pos += bytes.length
  }
  const beginObj = () => offsets.push(pos)

  pushText('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')

  beginObj()
  pushText('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')

  beginObj()
  pushText('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n')

  beginObj()
  pushText(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] ` +
      `/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
  )

  beginObj()
  pushText(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`,
  )
  pushBytes(jpegBytes)
  pushText('\nendstream\nendobj\n')

  beginObj()
  pushText(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`)

  const xrefStart = pos
  pushText(`xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n`)
  for (const off of offsets) {
    pushText(`${off.toString().padStart(10, '0')} 00000 n \n`)
  }
  pushText(`trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`)

  return new Blob(parts as BlobPart[], { type: 'application/pdf' })
}
