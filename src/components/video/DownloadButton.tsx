import { useState } from 'react'
import { ArrowDownTrayIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import type { VideoRecord } from '@lib/api'
import { cn } from '@lib/utils'

const safeName = (v: VideoRecord) => {
  const base = [v.generation?.title ?? v.production_model?.name ?? v.main_model?.name ?? `video-${v.id}`, v.orientation, v.quality]
    .join('_').replace(/[^\w\-]+/g, '_').replace(/_+/g, '_')
  return `${base}.mp4`
}

/**
 * Real file download. Fetches the signed url as a blob (so the browser saves it instead of
 * opening a tab, and we can show progress). If the storage blocks cross-origin reads (CORS),
 * it falls back to opening the signed url in a new tab.
 */
export const DownloadButton = ({ video, variant = 'icon', onError }: { video: VideoRecord; variant?: 'icon' | 'full'; onError?: (m: string) => void }) => {
  const [pct, setPct] = useState<number | null>(null)
  const url = video.file?.url
  if (!url) return null

  const run = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (pct !== null) return

    // Preferred: backend-signed "attachment" url → browser saves the file, no CORS involved.
    if (video.file?.download_url) {
      const a = document.createElement('a')
      a.href = video.file.download_url
      a.download = safeName(video)
      document.body.appendChild(a)
      a.click()
      a.remove()
      return
    }

    // Fallback (older backend): fetch as blob with progress.
    setPct(0)
    try {
      const res = await fetch(url)
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
      const total = Number(res.headers.get('content-length')) || video.file?.file_size || 0
      const reader = res.body.getReader()
      const chunks: Uint8Array[] = []
      let got = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        got += value.length
        if (total) setPct(Math.min(99, Math.round((got / total) * 100)))
      }
      const blob = new Blob(chunks as BlobPart[], { type: video.file?.mime_type || 'video/mp4' })
      const href = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = href
      a.download = safeName(video)
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(href), 10_000)
    } catch {
      window.open(url, '_blank', 'noopener')
      onError?.('Direct download was blocked (storage CORS), so the video was opened in a new tab. Use "Save video as" there.')
    } finally {
      setPct(null)
    }
  }

  const busy = pct !== null
  return (
    <button
      type="button" onClick={run} disabled={busy} title="Download MP4"
      className={cn(
        'inline-flex items-center justify-center gap-1.5 font-semibold transition-colors disabled:opacity-80',
        variant === 'icon' ? 'h-9 px-3 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs' : 'h-10 px-4 rounded-lg bg-[#ff5a36] text-white hover:bg-[#e8431f] text-sm'
      )}
    >
      {busy ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <ArrowDownTrayIcon className="w-4 h-4" />}
      {busy ? `${pct}%` : variant === 'full' ? 'Download MP4' : null}
    </button>
  )
}
