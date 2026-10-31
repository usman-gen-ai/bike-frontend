// Cross-browser / automation-friendly image file helpers.
//
// Why this exists: automation tools (Playwright, Puppeteer, Selenium, AI browser
// agents) often hand us a File whose `type` is '' (empty) or generic
// 'application/octet-stream'. Checking only `file.type.startsWith('image/')`
// rejects those even though the bytes are a perfectly valid image. We therefore
// sniff the real format from the file's magic bytes and fall back to the
// extension, then re-wrap the File with a correct MIME type so the backend
// (multer etc.) also sees a proper content-type.

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024

export const ACCEPTED_IMAGE_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
] as const

// Mime types AND extensions: some Android / WebView / older Safari builds
// ignore a mime-only `accept` list, so list extensions too.
export const IMAGE_ACCEPT_ATTR =
  'image/jpeg,image/png,image/webp,image/avif,image/gif,.jpg,.jpeg,.png,.webp,.avif,.gif'

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jpe: 'image/jpeg',
  jfif: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
}

function mimeFromExtension(name: string): string | null {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return EXT_TO_MIME[ext] ?? null
}

async function mimeFromMagicBytes(file: Blob): Promise<string | null> {
  try {
    const buf = new Uint8Array(await file.slice(0, 32).arrayBuffer())
    if (buf.length < 4) return null
    // JPEG: FF D8 FF
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
    // PNG: 89 50 4E 47
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png'
    // GIF: "GIF8"
    if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'image/gif'
    const ascii = (from: number, to: number) => String.fromCharCode(...buf.slice(from, to))
    // WEBP: "RIFF"....."WEBP"
    if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp'
    // AVIF: ....ftypavif / avis
    if (ascii(4, 8) === 'ftyp' && /^(avif|avis)$/.test(ascii(8, 12))) return 'image/avif'
  } catch {
    /* ignore – fall back to extension */
  }
  return null
}

export type ImageCheck =
  | { ok: true; file: File }
  | { ok: false; error: string }

/** Validate + normalise a user/automation supplied file. */
export async function prepareImageFile(input: File): Promise<ImageCheck> {
  if (!input || input.size === 0) return { ok: false, error: 'The selected file is empty.' }
  if (input.size > MAX_IMAGE_BYTES) return { ok: false, error: 'Image must be 10 MB or smaller.' }

  const declared = (input.type || '').toLowerCase()
  const sniffed = await mimeFromMagicBytes(input)
  const byExt = mimeFromExtension(input.name || '')

  // Trust the bytes first, then a declared image/* type, then the extension.
  const mime =
    sniffed ??
    (declared.startsWith('image/') && (ACCEPTED_IMAGE_MIME as readonly string[]).includes(declared)
      ? declared
      : null) ??
    byExt

  if (!mime) {
    return { ok: false, error: 'Please choose a JPG, PNG, WEBP, AVIF or GIF image.' }
  }

  // Make sure the name has a matching extension and the type is set explicitly.
  const needsRetype = input.type !== mime
  const hasExt = mimeFromExtension(input.name || '') !== null
  if (!needsRetype && hasExt) return { ok: true, file: input }

  const ext = Object.entries(EXT_TO_MIME).find(([, m]) => m === mime)?.[0] ?? 'jpg'
  const name = hasExt ? input.name : `${input.name || 'upload'}.${ext}`
  return { ok: true, file: new File([input], name, { type: mime, lastModified: input.lastModified }) }
}

/** Pull the first image File out of a drag-drop or paste DataTransfer. */
export function firstImageFromDataTransfer(dt: DataTransfer | null): File | null {
  if (!dt) return null
  if (dt.files && dt.files.length > 0) {
    const f = Array.from(dt.files).find(
      (x) => x.type.startsWith('image/') || mimeFromExtension(x.name) !== null || x.type === ''
    )
    if (f) return f
  }
  if (dt.items) {
    for (const item of Array.from(dt.items)) {
      if (item.kind === 'file') {
        const f = item.getAsFile()
        if (f && (f.type.startsWith('image/') || mimeFromExtension(f.name) !== null)) return f
      }
    }
  }
  return null
}
