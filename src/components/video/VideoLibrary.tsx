import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowPathIcon, ClockIcon, ExclamationCircleIcon, FilmIcon, PlayIcon,
} from '@heroicons/react/24/outline'
import { adminApi, getErrorMessage, type VideoOrientation, type VideoRecord, type VideoStatus } from '@lib/api'
import { cn, formatBytes, formatDate } from '@lib/utils'
import { EmptyState3D } from '@components/EmptyState3D'
import { Modal } from '@components/ui/Modal'
import { formatDuration } from './types'
import { DownloadButton } from './DownloadButton'

type Notify = (kind: 'success' | 'error' | 'info', msg: string, ms?: number) => void

const STATUS_STYLE: Record<VideoStatus, { label: string; cls: string }> = {
  queued: { label: 'Queued', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  processing: { label: 'Processing', cls: 'bg-purple-50 text-purple-700 ring-purple-200' },
  completed: { label: 'Completed', cls: 'bg-green-50 text-green-700 ring-green-200' },
  failed: { label: 'Failed', cls: 'bg-red-50 text-red-700 ring-red-200' },
}

const customTitle = (v: VideoRecord) => {
  const p = v.generations_preview ?? []
  const more = v.generations_count - Math.min(p.length, 2)
  return p.length ? `${p.slice(0, 2).join(', ')}${more > 0 ? ` +${more} more` : ''}` : `${v.generations_count} generations`
}
const titleOf = (v: VideoRecord) =>
  v.scope === 'custom'
    ? customTitle(v)
    : v.generation?.title ?? v.production_model?.name ?? v.main_model?.name ?? `Video #${v.id}`
const subOf = (v: VideoRecord) =>
  v.scope === 'custom'
    ? `Custom selection · ${v.generations_count} generation${v.generations_count === 1 ? '' : 's'}${v.main_model ? ` · ${v.main_model.name}` : ''}`
    : [v.main_model?.name, v.production_model?.name, v.generation?.title].filter(Boolean).slice(0, -1).join(' › ') ||
      (v.scope === 'main_model' ? 'Entire main model' : '')

const OrientationGlyph = ({ o }: { o: VideoOrientation }) => (
  <span className={cn('inline-block border-[1.5px] border-current rounded-[2px]', o === 'portrait' ? 'w-2 h-3' : 'w-3.5 h-2')} />
)

// ── single card ──────────────────────────────────────────────────────────

const VideoCard = ({ v, onOpen, onRetry, retrying, onError }: { v: VideoRecord; onOpen: () => void; onRetry: () => void; retrying: boolean; onError: (m: string) => void }) => {
  const st = STATUS_STYLE[v.status]
  const ref = useRef<HTMLVideoElement>(null)
  const url = v.file?.url

  return (
    <article className="anim-pop rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
      <div
        className="relative aspect-[16/10] bg-[#0b1020] grid place-items-center overflow-hidden"
        onMouseEnter={() => ref.current?.play().catch(() => {})}
        onMouseLeave={() => { if (ref.current) { ref.current.pause(); ref.current.currentTime = 0.1 } }}
      >
        {v.status === 'completed' && url ? (
          <button type="button" onClick={onOpen} className="absolute inset-0 group" aria-label={`Play ${titleOf(v)}`}>
            <video ref={ref} src={`${url}#t=0.1`} preload="metadata" muted playsInline loop className="w-full h-full object-contain" />
            <span className="absolute inset-0 grid place-items-center bg-black/0 group-hover:bg-black/20 transition-colors">
              <span className="w-12 h-12 rounded-full bg-white/90 grid place-items-center shadow-lg group-hover:scale-110 transition-transform">
                <PlayIcon className="w-6 h-6 text-slate-900 translate-x-px" />
              </span>
            </span>
          </button>
        ) : v.status === 'failed' ? (
          <div className="text-center px-5">
            <ExclamationCircleIcon className="w-9 h-9 text-red-400 mx-auto" />
            <p className="mt-2 text-xs text-red-200 line-clamp-3">{v.error_message || 'Render failed.'}</p>
          </div>
        ) : (
          <div className="w-full px-8 text-center">
            <div className="relative h-1.5 rounded-full bg-white/15 overflow-hidden">
              <div className={cn('h-full rounded-full bg-[#ff5a36] transition-all duration-700', v.status === 'queued' && 'opacity-40')} style={{ width: `${Math.max(v.status === 'queued' ? 8 : 4, v.progress)}%` }} />
            </div>
            <p className="mt-3 text-xs text-slate-300 inline-flex items-center gap-2">
              {v.status === 'processing' ? <><span className="w-2 h-2 rounded-full bg-[#ff5a36] rec-dot" /> Rendering {v.progress}%</> : <><ClockIcon className="w-4 h-4" /> Waiting in queue…</>}
            </p>
          </div>
        )}

        <span className="absolute top-2 left-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/60 text-white text-[11px] font-semibold backdrop-blur">
          <OrientationGlyph o={v.orientation} /> {v.orientation === 'portrait' ? '9:16' : '16:9'}
        </span>
        <span className="absolute top-2 right-2 px-2 py-1 rounded-md bg-black/60 text-white text-[11px] font-bold backdrop-blur">{v.quality.toUpperCase()}</span>
        {v.status === 'completed' && <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-white text-[11px] tabular-nums">{formatDuration(v.duration_seconds)}</span>}
      </div>

      <div className="p-3.5 flex-1 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="font-display font-bold text-slate-900 truncate">{titleOf(v)}</h4>
            {subOf(v) && <p className="text-xs text-slate-500 truncate">{subOf(v)}</p>}
          </div>
          <span className={cn('shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-inset', st.cls)}>{st.label}</span>
        </div>

        <p className="text-[11px] text-slate-500 tabular-nums">
          #{v.id} · {v.generations_count} gen{v.resolution ? ` · ${v.resolution}` : ''}{v.file?.file_size ? ` · ${formatBytes(v.file.file_size)}` : ''}
        </p>
        <p className="text-[11px] text-slate-400">{formatDate(v.created_at)}</p>

        <div className="mt-auto pt-1 flex gap-2">
          {v.status === 'completed' && url && (
            <>
              <button onClick={onOpen} className="flex-1 h-9 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-700 inline-flex items-center justify-center gap-1.5"><PlayIcon className="w-4 h-4" /> Watch</button>
              <DownloadButton video={v} onError={onError} />
            </>
          )}
          {v.status === 'failed' && (
            <button onClick={onRetry} disabled={retrying} className="flex-1 h-9 rounded-lg bg-[#ff5a36] text-white text-xs font-semibold hover:bg-[#e8431f] disabled:opacity-60 inline-flex items-center justify-center gap-1.5">
              <ArrowPathIcon className={cn('w-4 h-4', retrying && 'animate-spin')} /> Try again
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

// ── player modal ─────────────────────────────────────────────────────────

const PlayerModal = ({ video, onClose, onError }: { video: VideoRecord | null; onClose: () => void; onError: (m: string) => void }) => {
  const [full, setFull] = useState<VideoRecord | null>(null)

  useEffect(() => {
    setFull(null)
    if (!video) return
    let alive = true
    adminApi.getVideo(video.id).then((d) => alive && setFull(d)).catch(() => {})
    return () => { alive = false }
  }, [video])

  const v = full ?? video
  const portrait = v?.orientation === 'portrait'

  return (
    <Modal isOpen={!!video} onClose={onClose} size="full" title={v ? titleOf(v) : ''} description={v ? `${v.orientation} · ${v.quality.toUpperCase()}${v.resolution ? ` · ${v.resolution}` : ''} · ${formatDuration(v.duration_seconds)}` : undefined}>
      {v?.file?.url && (
        <div className={cn('grid gap-5', portrait ? 'md:grid-cols-[minmax(0,22rem)_1fr]' : 'lg:grid-cols-[minmax(0,1fr)_18rem]')}>
          <div className="rounded-xl bg-black overflow-hidden grid place-items-center">
            <video key={v.id} src={v.file.url} controls autoPlay playsInline className={cn('w-full', portrait ? 'max-h-[72vh]' : 'max-h-[65vh]')} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-slate-800">Timeline</p>
            </div>
            <DownloadButton video={v} variant="full" onError={onError} />
            <p className="text-[11px] text-slate-400 mt-2 mb-3 tabular-nums">{v.file.file_size ? formatBytes(v.file.file_size) : ''}</p>
            {!full ? (
              <p className="text-xs text-slate-400 flex items-center gap-2"><ArrowPathIcon className="w-4 h-4 animate-spin" /> Loading…</p>
            ) : (
              <ol className="space-y-1.5 max-h-[55vh] overflow-y-auto pr-1">
                {full.items?.map((it) => (
                  <li key={it.position} className="rounded-lg border border-slate-200 px-3 py-2">
                    <p className="text-[13px] font-medium text-slate-900 truncate">{it.title}</p>
                    <p className="text-[11px] text-slate-500 tabular-nums">{formatDuration(it.start_second)} – {formatDuration(it.end_second)} · {it.images_count} image{it.images_count === 1 ? '' : 's'}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}

// ── library ──────────────────────────────────────────────────────────────

const OR_FILTERS: { value: 'all' | VideoOrientation; label: string }[] = [
  { value: 'all', label: 'All' }, { value: 'landscape', label: 'Landscape' }, { value: 'portrait', label: 'Portrait' },
]
const ST_FILTERS: { value: 'all' | VideoStatus; label: string }[] = [
  { value: 'all', label: 'All statuses' }, { value: 'completed', label: 'Completed' }, { value: 'processing', label: 'Processing' }, { value: 'queued', label: 'Queued' }, { value: 'failed', label: 'Failed' },
]

export const VideoLibrary = ({ refreshKey, notify }: { refreshKey: number; notify: Notify }) => {
  const [orientation, setOrientation] = useState<'all' | VideoOrientation>('all')
  const [status, setStatus] = useState<'all' | VideoStatus>('all')
  const [videos, setVideos] = useState<VideoRecord[]>([])
  const [meta, setMeta] = useState({ total: 0, current_page: 1, last_page: 1 })
  const [loading, setLoading] = useState(true)
  const [more, setMore] = useState(false)
  const [failed, setFailed] = useState(false)
  const [playing, setPlaying] = useState<VideoRecord | null>(null)
  const [retryingId, setRetryingId] = useState<number | null>(null)
  const seq = useRef(0)

  const fetchPage = useCallback(async (page: number, append: boolean) => {
    const my = ++seq.current
    append ? setMore(true) : setLoading(true)
    setFailed(false)
    try {
      const res = await adminApi.listVideos({
        page, limit: 12,
        ...(orientation !== 'all' && { orientation }),
        ...(status !== 'all' && { status }),
      })
      if (my !== seq.current) return
      setVideos((prev) => (append ? [...prev, ...res.videos.filter((n) => !prev.some((p) => p.id === n.id))] : res.videos))
      setMeta(res.meta)
    } catch (e) {
      if (my !== seq.current) return
      setFailed(true)
      notify('error', getErrorMessage(e))
    } finally {
      if (my === seq.current) { setLoading(false); setMore(false) }
    }
  }, [orientation, status, notify])

  useEffect(() => { fetchPage(1, false) }, [fetchPage, refreshKey])

  // poll only the videos that are still queued / rendering
  const activeKey = useMemo(() => videos.filter((v) => v.status === 'queued' || v.status === 'processing').map((v) => v.id).join(','), [videos])
  useEffect(() => {
    if (!activeKey) return
    const ids = activeKey.split(',').map(Number)
    const t = setInterval(async () => {
      const fresh = await Promise.all(ids.map((id) => adminApi.getVideo(id).catch(() => null)))
      setVideos((prev) => prev.map((p) => fresh.find((f) => f?.id === p.id) ?? p))
      fresh.forEach((f) => {
        if (!f) return
        if (f.status === 'completed') notify('success', `Video #${f.id} is ready: ${titleOf(f)}`)
        if (f.status === 'failed') notify('error', `Video #${f.id} failed.`)
      })
    }, 4000)
    return () => clearInterval(t)
  }, [activeKey, notify])

  const retry = async (v: VideoRecord) => {
    setRetryingId(v.id)
    try {
      const upd = await adminApi.retryVideo(v.id)
      setVideos((prev) => prev.map((p) => (p.id === v.id ? upd : p)))
      notify('info', `Video #${v.id} re-queued.`)
    } catch (e) {
      notify('error', getErrorMessage(e))
    } finally {
      setRetryingId(null)
    }
  }

  const filtered = orientation !== 'all' || status !== 'all'

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2.5 mb-4">
        <div className="inline-flex p-1 rounded-xl bg-slate-100" role="tablist" aria-label="Orientation filter">
          {OR_FILTERS.map((f) => (
            <button key={f.value} role="tab" aria-selected={orientation === f.value} onClick={() => setOrientation(f.value)}
              className={cn('px-3 h-8 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors', orientation === f.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800')}>
              {f.value !== 'all' && <OrientationGlyph o={f.value} />} {f.label}
            </button>
          ))}
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as 'all' | VideoStatus)} aria-label="Status filter"
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#ff5a36]/40">
          {ST_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <span className="ml-auto text-xs text-slate-400 tabular-nums">{meta.total} video{meta.total === 1 ? '' : 's'} · newest first</span>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {[0, 1, 2, 3].map((i) => <div key={i} className="relative overflow-hidden rounded-2xl bg-slate-200/70 aspect-[4/3] anim-sweep" />)}
        </div>
      ) : failed ? (
        <EmptyState3D variant="error" title="Couldn't load videos" message="The list could not be fetched from the server. Please try again."
          action={<button onClick={() => fetchPage(1, false)} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700">Retry</button>} />
      ) : videos.length === 0 ? (
        filtered ? (
          <EmptyState3D variant="filter" title="No videos match this filter" message="Try changing the orientation or status filter."
            action={<button onClick={() => { setOrientation('all'); setStatus('all') }} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700">Clear filters</button>} />
        ) : (
          <EmptyState3D variant="video" title="No videos yet" message="Pick a model on the left, choose orientation and quality, then click Generate Video. Videos in progress will show up here in order." />
        )
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {videos.map((v) => (
              <VideoCard key={v.id} v={v} onOpen={() => setPlaying(v)} onRetry={() => retry(v)} retrying={retryingId === v.id} onError={(m) => notify('info', m, 9000)} />
            ))}
          </div>
          {meta.current_page < meta.last_page && (
            <div className="mt-5 text-center">
              <button onClick={() => fetchPage(meta.current_page + 1, true)} disabled={more}
                className="px-5 h-10 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 inline-flex items-center gap-2">
                {more ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <FilmIcon className="w-4 h-4" />} Aur videos
              </button>
            </div>
          )}
        </>
      )}

      <PlayerModal video={playing} onClose={() => setPlaying(null)} onError={(m) => notify('info', m, 9000)} />
    </div>
  )
}
