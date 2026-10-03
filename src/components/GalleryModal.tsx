import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowPathIcon,
  ArrowsPointingOutIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  PhotoIcon,
  VideoCameraIcon,
  XMarkIcon,
  ArrowUpTrayIcon,
} from '@heroicons/react/24/outline'
import {
  adminApi,
  getErrorMessage,
  type AssetTarget,
  type GalleryImage,
  type GenerationAssetState,
  type GenerationItem,
} from '@lib/api'
import { cn, formatBytes } from '@lib/utils'
import { AssetBadge } from './StatusBadges'

interface Props {
  generation: GenerationItem
  onClose: () => void
  onStateChange: (id: number, state: Partial<GenerationAssetState>) => void
  notify: (kind: 'success' | 'error' | 'info', message: string, ms?: number) => void
}

const SHARED_NOTICE =
  'This is one single image shared by BOTH the video and thumbnail sections, so replacing it changes it in both places. ' +
  'The previous file stays stored in S3 (it is not deleted).'

const sameSet = (a: Set<number>, b: Set<number>) => a.size === b.size && [...a].every((x) => b.has(x))

const TABS: { target: AssetTarget; label: string; icon: typeof PhotoIcon; active: string; ring: string; chip: string }[] = [
  { target: 'video', label: 'Video Images', icon: VideoCameraIcon, active: 'bg-blue-600 text-white shadow-md', ring: 'ring-blue-500', chip: 'bg-blue-600' },
  { target: 'thumbnail', label: 'Thumbnail Images', icon: PhotoIcon, active: 'bg-amber-500 text-white shadow-md', ring: 'ring-amber-500', chip: 'bg-amber-500' },
]

export const GalleryModal = ({ generation, onClose, onStateChange, notify }: Props) => {
  const [images, setImages] = useState<GalleryImage[]>([])
  const [state, setState] = useState<GenerationAssetState>(generation)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [tab, setTab] = useState<AssetTarget>('video')
  const [sel, setSel] = useState<Record<AssetTarget, Set<number>>>({ video: new Set(), thumbnail: new Set() })
  const [saved, setSaved] = useState<Record<AssetTarget, Set<number>>>({ video: new Set(), thumbnail: new Set() })
  const [saving, setSaving] = useState(false)

  const [preview, setPreview] = useState<number | null>(null) // index in images
  const [pending, setPending] = useState<{ image: GalleryImage; file: File; localUrl: string } | null>(null)
  const [replacing, setReplacing] = useState(false)
  const [broken, setBroken] = useState<Set<number>>(new Set())

  const fileInput = useRef<HTMLInputElement>(null)
  const replaceTarget = useRef<GalleryImage | null>(null)

  // ── load ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true
    adminApi
      .getGallery(generation.id)
      .then((res) => {
        if (!alive) return
        setImages(res.images)
        setState(res.generation)
        const v = new Set(res.images.filter((i) => i.is_video_source).map((i) => i.id))
        const t = new Set(res.images.filter((i) => i.is_thumbnail_source).map((i) => i.id))
        setSel({ video: new Set(v), thumbnail: new Set(t) })
        setSaved({ video: v, thumbnail: t })
      })
      .catch((e) => alive && setError(getErrorMessage(e)))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [generation.id])

  // lock page scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // keyboard: Esc / arrows
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (pending) setPending(null)
        else if (preview !== null) setPreview(null)
        else onClose()
      }
      if (preview !== null && images.length > 0) {
        if (e.key === 'ArrowRight') setPreview((p) => (p === null ? p : (p + 1) % images.length))
        if (e.key === 'ArrowLeft') setPreview((p) => (p === null ? p : (p - 1 + images.length) % images.length))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [preview, pending, images.length, onClose])

  const status = tab === 'video' ? state.video_status : state.thumbnail_status
  const locked = status === 'processing'
  const dirty = !sameSet(sel[tab], saved[tab])
  const activeTab = TABS.find((t) => t.target === tab)!

  const toggle = (id: number) => {
    if (locked) return
    setSel((prev) => {
      const next = new Set(prev[tab])
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { ...prev, [tab]: next }
    })
  }

  const selectAll = () => setSel((p) => ({ ...p, [tab]: new Set(images.map((i) => i.id)) }))
  const clearAll = () => setSel((p) => ({ ...p, [tab]: new Set() }))
  const resetDraft = () => setSel((p) => ({ ...p, [tab]: new Set(saved[tab]) }))

  // ── save selection ──────────────────────────────────────────────────────
  const save = async () => {
    setSaving(true)
    try {
      const ids = [...sel[tab]]
      const next = await adminApi.updateSelection(generation.id, tab, ids)
      setState((s) => ({ ...s, ...next }))
      onStateChange(generation.id, next)
      setSaved((s) => ({ ...s, [tab]: new Set(ids) }))
      const key = tab === 'video' ? 'is_video_source' : 'is_thumbnail_source'
      setImages((list) => list.map((i) => ({ ...i, [key]: ids.includes(i.id) })))
      notify('success', `${ids.length} image${ids.length === 1 ? '' : 's'} saved for ${tab}.`)
    } catch (e) {
      notify('error', getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  // ── replace image ───────────────────────────────────────────────────────
  const startReplace = (img: GalleryImage) => {
    replaceTarget.current = img
    fileInput.current?.click()
  }

  const onFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    const image = replaceTarget.current
    if (!file || !image) return
    if (!file.type.startsWith('image/')) return notify('error', 'Please choose an image file.')
    if (file.size > 10 * 1024 * 1024) return notify('error', 'Image must be 10 MB or smaller.')
    setPending({ image, file, localUrl: URL.createObjectURL(file) })
  }

  const cancelReplace = useCallback(() => {
    setPending((p) => {
      if (p) URL.revokeObjectURL(p.localUrl)
      return null
    })
  }, [])

  const confirmReplace = async () => {
    if (!pending) return
    setReplacing(true)
    try {
      const res = await adminApi.replaceImage(pending.image.id, pending.file)
      setImages((list) => list.map((i) => (i.id === res.image.id ? res.image : i)))
      setBroken((b) => { const n = new Set(b); n.delete(res.image.id); return n })
      notify('success', res.notice || SHARED_NOTICE, 9000)
      cancelReplace()
    } catch (e) {
      notify('error', getErrorMessage(e))
    } finally {
      setReplacing(false)
    }
  }

  const otherTab = tab === 'video' ? 'thumbnail' : 'video'
  const selectedCount = sel[tab].size
  const previewImg = preview !== null ? images[preview] : null
  const hasBothSelections = useMemo(() => images.filter((i) => i.is_video_source && i.is_thumbnail_source).length, [images])

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="relative bg-white w-full max-w-6xl h-full sm:h-[92vh] sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 sm:px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 truncate">{generation.title}</h2>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <AssetBadge target="video" status={state.video_status} />
              <AssetBadge target="thumbnail" status={state.thumbnail_status} />
              <span className="text-xs text-gray-400">{images.length} images</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" aria-label="Close">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-5 sm:px-6 pt-4">
          <div className="inline-flex p-1 rounded-xl bg-gray-100 gap-1 w-full sm:w-auto">
            {TABS.map((t) => (
              <button
                key={t.target}
                onClick={() => setTab(t.target)}
                className={cn(
                  'flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all',
                  tab === t.target ? t.active : 'text-gray-600 hover:bg-white/70'
                )}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
                <span className={cn('px-1.5 rounded-full text-[11px]', tab === t.target ? 'bg-white/25' : 'bg-gray-200 text-gray-600')}>
                  {sel[t.target].size}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-5 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-gray-500">
            Click an image to {sel[tab].size ? 'toggle it' : 'select it'} for <b>{tab}</b>.
            {hasBothSelections > 0 && <span className="text-gray-400"> · {hasBothSelections} image(s) used in both.</span>}
          </p>
          <div className="flex items-center gap-1.5">
            <button onClick={selectAll} disabled={locked || loading} className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40">Select all</button>
            <button onClick={clearAll} disabled={locked || loading || selectedCount === 0} className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40">Clear</button>
          </div>
        </div>

        {locked && (
          <div className="mx-5 sm:mx-6 mb-2 flex items-center gap-2 rounded-lg bg-purple-50 border border-purple-200 text-purple-700 text-xs px-3 py-2">
            <ExclamationTriangleIcon className="w-4 h-4" /> {tab === 'video' ? 'Video' : 'Thumbnail'} is processing, so the selection is locked.
          </div>
        )}

        {/* Grid */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 pb-4">
          {loading ? (
            <div className="h-full flex items-center justify-center text-gray-400 gap-2"><ArrowPathIcon className="w-5 h-5 animate-spin" /> Loading images…</div>
          ) : error ? (
            <div className="h-full flex items-center justify-center text-red-600 text-sm">{error}</div>
          ) : images.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400"><PhotoIcon className="w-12 h-12 opacity-40" /><p className="text-sm mt-2">No images for this generation.</p></div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {images.map((img, idx) => {
                const isSel = sel[tab].has(img.id)
                const inOther = sel[otherTab].has(img.id)
                return (
                  <div
                    key={img.id}
                    onClick={() => toggle(img.id)}
                    className={cn(
                      'group relative rounded-xl overflow-hidden bg-gray-100 aspect-[4/3] cursor-pointer transition-all ring-2',
                      isSel ? `${activeTab.ring} shadow-lg scale-[0.98]` : 'ring-transparent hover:ring-gray-300',
                      locked && 'cursor-not-allowed opacity-80'
                    )}
                  >
                    {img.url && !broken.has(img.id) ? (
                      <img
                        src={img.url} alt={img.file_name} loading="lazy"
                        onError={() => setBroken((b) => new Set(b).add(img.id))}
                        className={cn('w-full h-full object-cover transition-transform duration-300', !isSel && 'group-hover:scale-105')}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300"><PhotoIcon className="w-10 h-10" /></div>
                    )}

                    <div className={cn('absolute inset-0 pointer-events-none transition-colors', isSel ? 'bg-black/0' : 'group-hover:bg-black/10')} />

                    {/* check */}
                    <div className={cn(
                      'absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all',
                      isSel ? `${activeTab.chip} border-white text-white` : 'bg-black/30 border-white/80 text-transparent group-hover:text-white/70'
                    )}>
                      <CheckIcon className="w-3.5 h-3.5" strokeWidth={3} />
                    </div>

                    {/* actions */}
                    <div className="absolute top-2 right-2 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button
                        title="Preview" onClick={(e) => { e.stopPropagation(); setPreview(idx) }}
                        className="p-1.5 rounded-lg bg-black/55 text-white hover:bg-black/80"
                      ><ArrowsPointingOutIcon className="w-3.5 h-3.5" /></button>
                      <button
                        title="Replace image" onClick={(e) => { e.stopPropagation(); startReplace(img) }}
                        className="p-1.5 rounded-lg bg-black/55 text-white hover:bg-black/80"
                      ><ArrowUpTrayIcon className="w-3.5 h-3.5" /></button>
                    </div>

                    {/* footer chips */}
                    <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/70 to-transparent flex items-end justify-between gap-1">
                      <span className="text-[10px] text-white/90 truncate">#{idx + 1} · {formatBytes(img.file_size)}</span>
                      <div className="flex gap-1">
                        {img.is_replaced && <span className="px-1.5 py-0.5 rounded bg-white/90 text-[9px] font-semibold text-gray-700">Replaced</span>}
                        {inOther && <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-semibold text-white', otherTab === 'video' ? 'bg-blue-600' : 'bg-amber-500')}>Also {otherTab}</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 sm:px-6 py-3.5 border-t border-gray-100 bg-gray-50">
          <p className="text-sm text-gray-600">
            <b className="text-gray-900">{selectedCount}</b> selected for {tab}
            {dirty && <span className="ml-2 text-amber-600 text-xs font-medium">● unsaved changes</span>}
          </p>
          <div className="flex items-center gap-2">
            {dirty && <button onClick={resetDraft} disabled={saving} className="px-3 py-2 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-200">Discard</button>}
            <button
              onClick={save} disabled={!dirty || saving || locked}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed',
                tab === 'video' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-amber-500 hover:bg-amber-600'
              )}
            >
              {saving ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <CheckIcon className="w-4 h-4" />}
              Update selected images for {tab === 'video' ? 'Video' : 'Thumbnail'}
            </button>
          </div>
        </div>

        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif" className="hidden" onChange={onFileChosen} />

        {/* Replace confirmation */}
        {pending && (
          <div className="absolute inset-0 z-10 bg-slate-900/60 flex items-center justify-center p-4" onClick={replacing ? undefined : cancelReplace}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-base font-bold text-gray-900">Replace this image?</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">Current</p>
                  <div className="aspect-[4/3] rounded-lg overflow-hidden bg-gray-100">{pending.image.url && <img src={pending.image.url} className="w-full h-full object-cover" alt="current" />}</div>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">New</p>
                  <div className="aspect-[4/3] rounded-lg overflow-hidden bg-gray-100"><img src={pending.localUrl} className="w-full h-full object-cover" alt="new" /></div>
                </div>
              </div>
              <div className="flex gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 leading-relaxed">
                <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{SHARED_NOTICE}</span>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={cancelReplace} disabled={replacing} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
                <button onClick={confirmReplace} disabled={replacing} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-white hover:bg-primary-hover disabled:opacity-60">
                  {replacing ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <ArrowUpTrayIcon className="w-4 h-4" />} Replace in both
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lightbox */}
        {previewImg && (
          <div
            className="absolute inset-0 z-20 bg-black/92 flex flex-col items-center justify-center"
            onClick={() => setPreview(null)}
          >
            {/* Top bar */}
            <div className="absolute top-0 inset-x-0 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent z-10" onClick={(e) => e.stopPropagation()}>
              <p className="text-xs text-white/70 truncate max-w-xs">{previewImg.file_name}</p>
              <div className="flex items-center gap-2">
                {/* Download */}
                <a
                  href={previewImg.url ?? undefined}
                  download={previewImg.file_name}
                  target="_blank"
                  rel="noreferrer"
                  title="Download"
                  className="p-2 rounded-full bg-white/10 text-white hover:bg-white/25 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 4v11" />
                  </svg>
                </a>
                {/* Close */}
                <button
                  className="p-2 rounded-full bg-white/10 text-white hover:bg-white/25 transition-colors"
                  onClick={() => setPreview(null)}
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Prev / Next */}
            {images.length > 1 && (
              <>
                <button
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/10 text-white hover:bg-white/25 transition-colors"
                  onClick={(e) => { e.stopPropagation(); setPreview((preview! - 1 + images.length) % images.length) }}
                >
                  <ChevronLeftIcon className="w-6 h-6" />
                </button>
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/10 text-white hover:bg-white/25 transition-colors"
                  onClick={(e) => { e.stopPropagation(); setPreview((preview! + 1) % images.length) }}
                >
                  <ChevronRightIcon className="w-6 h-6" />
                </button>
              </>
            )}

            {/* Image — full center */}
            <div
              className="w-full h-full flex items-center justify-center px-16 py-16"
              onClick={(e) => e.stopPropagation()}
            >
              {previewImg.url && (
                <img
                  src={previewImg.url}
                  alt={previewImg.file_name}
                  className="max-w-full max-h-full w-auto h-auto object-contain rounded-lg shadow-2xl"
                  style={{ maxWidth: '100%', maxHeight: '100%' }}
                />
              )}
            </div>

            {/* Bottom counter */}
            <div className="absolute bottom-4 inset-x-0 flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
              <span className="text-xs text-white/60 bg-black/40 px-3 py-1 rounded-full">
                {preview! + 1} / {images.length}
                {previewImg.file_size ? ` · ${formatBytes(previewImg.file_size)}` : ''}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
