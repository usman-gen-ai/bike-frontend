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
  ArrowDownTrayIcon,
  SparklesIcon,
  SwatchIcon,
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

type BgChoice = 'checker' | 'white' | 'black' | 'dark' | 'light' | 'custom'

const isEnhancedImage = (img: GalleryImage): boolean => {
  const name = img.file_name?.toLowerCase() || ''
  return name.includes('enhanced') || name.includes('-1.') || name.includes('_cutout') || img.mime_type === 'image/png'
}

export const GalleryModal = ({ generation, onClose, onStateChange, notify }: Props) => {
  const [images, setImages] = useState<GalleryImage[]>([])
  const [state, setState] = useState<GenerationAssetState>(generation)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [tab, setTab] = useState<AssetTarget>('video')
  const [sel, setSel] = useState<Record<AssetTarget, Set<number>>>({ video: new Set(), thumbnail: new Set() })
  const [saved, setSaved] = useState<Record<AssetTarget, Set<number>>>({ video: new Set(), thumbnail: new Set() })
  const [saving, setSaving] = useState(false)

  // Background color preview state
  const [bgChoice, setBgChoice] = useState<BgChoice>('checker')
  const [customBgColor, setCustomBgColor] = useState('#2563eb')

  const [preview, setPreview] = useState<number | null>(null) // index in images
  const [pending, setPending] = useState<{ image: GalleryImage; file: File; localUrl: string; mode: 'enhanced' | 'replace' } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [broken, setBroken] = useState<Set<number>>(new Set())
  const [downloadingId, setDownloadingId] = useState<number | null>(null)

  const fileInput = useRef<HTMLInputElement>(null)
  const uploadTarget = useRef<{ image: GalleryImage; mode: 'enhanced' | 'replace' } | null>(null)

  // ── dynamic background style for transparent cutout inspection ─────────
  const bgStyle = useMemo(() => {
    if (bgChoice === 'white') return { backgroundColor: '#ffffff' }
    if (bgChoice === 'black') return { backgroundColor: '#000000' }
    if (bgChoice === 'dark') return { backgroundColor: '#0f172a' }
    if (bgChoice === 'light') return { backgroundColor: '#f1f5f9' }
    if (bgChoice === 'custom') return { backgroundColor: customBgColor }
    return {
      backgroundImage: `linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)`,
      backgroundSize: '16px 16px',
      backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
      backgroundColor: '#ffffff',
    }
  }, [bgChoice, customBgColor])

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
        if (pending) cancelPending()
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

  // ── upload image (enhanced alongside or replace) ─────────────────────────
  const startUpload = (img: GalleryImage, mode: 'enhanced' | 'replace') => {
    uploadTarget.current = { image: img, mode }
    fileInput.current?.click()
  }

  const onFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    const target = uploadTarget.current
    if (!file || !target) return
    if (!file.type.startsWith('image/')) return notify('error', 'Please choose an image file.')
    if (file.size > 10 * 1024 * 1024) return notify('error', 'Image must be 10 MB or smaller.')
    setPending({ image: target.image, file, localUrl: URL.createObjectURL(file), mode: target.mode })
  }

  const cancelPending = useCallback(() => {
    setPending((p) => {
      if (p) URL.revokeObjectURL(p.localUrl)
      return null
    })
  }, [])

  const confirmUpload = async () => {
    if (!pending) return
    setUploading(true)
    try {
      if (pending.mode === 'enhanced') {
        const res = await adminApi.addEnhancedImage(pending.image.id, pending.file)
        setImages((list) => [...list, res.image])
        notify('success', 'Enhanced image added alongside original! Both are now available to compare and select.', 8000)
      } else {
        const res = await adminApi.replaceImage(pending.image.id, pending.file)
        setImages((list) => list.map((i) => (i.id === res.image.id ? res.image : i)))
        setBroken((b) => { const n = new Set(b); n.delete(res.image.id); return n })
        notify('success', res.notice || SHARED_NOTICE, 9000)
      }
      cancelPending()
    } catch (e) {
      notify('error', getErrorMessage(e))
    } finally {
      setUploading(false)
    }
  }

  const downloadImage = async (img: GalleryImage, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (!img.url) return
    setDownloadingId(img.id)
    try {
      const res = await fetch(img.url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = img.file_name || `image-${img.id}.jpg`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
    } catch {
      const a = document.createElement('a')
      a.href = img.url
      a.download = img.file_name || `image-${img.id}.jpg`
      document.body.appendChild(a)
      a.click()
      a.remove()
    } finally {
      setDownloadingId(null)
    }
  }

  const otherTab = tab === 'video' ? 'thumbnail' : 'video'
  const selectedCount = sel[tab].size
  const previewImg = preview !== null ? images[preview] : null
  const hasBothSelections = useMemo(() => images.filter((i) => i.is_video_source && i.is_thumbnail_source).length, [images])

  // Background picker component (reusable in toolbar and lightbox)
  const renderBgSwitcher = () => (
    <div className="inline-flex items-center gap-1.5 bg-gray-100/90 backdrop-blur-sm p-1 rounded-xl text-xs border border-gray-200/80 shadow-sm">
      <span className="text-[11px] font-semibold text-gray-500 px-1.5 flex items-center gap-1">
        <SwatchIcon className="w-3.5 h-3.5 text-gray-400" /> BG:
      </span>
      {/* Checkerboard */}
      <button
        type="button"
        title="Transparent (Checkerboard)"
        onClick={() => setBgChoice('checker')}
        className={cn(
          'w-6 h-6 rounded-lg border text-[10px] font-bold transition-all shadow-sm',
          bgChoice === 'checker' ? 'ring-2 ring-primary border-primary scale-105' : 'border-gray-300 opacity-80 hover:opacity-100'
        )}
        style={{
          backgroundImage: `linear-gradient(45deg, #cbd5e1 25%, transparent 25%), linear-gradient(-45deg, #cbd5e1 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #cbd5e1 75%), linear-gradient(-45deg, transparent 75%, #cbd5e1 75%)`,
          backgroundSize: '8px 8px',
          backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0',
          backgroundColor: '#ffffff',
        }}
      />
      {/* White */}
      <button
        type="button"
        title="White Background"
        onClick={() => setBgChoice('white')}
        className={cn(
          'w-6 h-6 rounded-lg border bg-white transition-all shadow-sm',
          bgChoice === 'white' ? 'ring-2 ring-primary border-primary scale-105' : 'border-gray-300 opacity-80 hover:opacity-100'
        )}
      />
      {/* Black */}
      <button
        type="button"
        title="Black Background"
        onClick={() => setBgChoice('black')}
        className={cn(
          'w-6 h-6 rounded-lg border bg-black transition-all shadow-sm',
          bgChoice === 'black' ? 'ring-2 ring-primary border-primary scale-105' : 'border-transparent opacity-80 hover:opacity-100'
        )}
      />
      {/* Dark Slate */}
      <button
        type="button"
        title="Dark Slate (#0F172A)"
        onClick={() => setBgChoice('dark')}
        className={cn(
          'w-6 h-6 rounded-lg border bg-slate-900 transition-all shadow-sm',
          bgChoice === 'dark' ? 'ring-2 ring-primary border-primary scale-105' : 'border-transparent opacity-80 hover:opacity-100'
        )}
      />
      {/* Light Gray */}
      <button
        type="button"
        title="Light Gray (#F1F5F9)"
        onClick={() => setBgChoice('light')}
        className={cn(
          'w-6 h-6 rounded-lg border bg-slate-200 transition-all shadow-sm',
          bgChoice === 'light' ? 'ring-2 ring-primary border-primary scale-105' : 'border-gray-300 opacity-80 hover:opacity-100'
        )}
      />
      {/* Custom Color Picker */}
      <label
        title="Custom Background Color"
        className={cn(
          'w-6 h-6 rounded-lg border cursor-pointer relative overflow-hidden transition-all shadow-sm flex items-center justify-center',
          bgChoice === 'custom' ? 'ring-2 ring-primary border-primary scale-105' : 'border-gray-300 opacity-80 hover:opacity-100'
        )}
        style={{ backgroundColor: customBgColor }}
      >
        <input
          type="color"
          value={customBgColor}
          onChange={(e) => {
            setCustomBgColor(e.target.value)
            setBgChoice('custom')
          }}
          className="opacity-0 absolute inset-0 cursor-pointer w-full h-full"
        />
      </label>
    </div>
  )

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
              <span className="text-xs text-gray-400">{images.length} images (compare original vs enhanced)</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" aria-label="Close">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs & BG preview switcher bar */}
        <div className="px-5 sm:px-6 pt-3 flex flex-wrap items-center justify-between gap-3">
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

          {/* Interactive BG color switcher */}
          <div className="flex items-center gap-2">
            {renderBgSwitcher()}
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-5 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-gray-100">
          <p className="text-xs text-gray-500">
            Select images for <b>{tab}</b>. Original and enhanced cutout versions are kept side-by-side.
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
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4">
          {loading ? (
            <div className="h-full flex items-center justify-center text-gray-400 gap-2"><ArrowPathIcon className="w-5 h-5 animate-spin" /> Loading images…</div>
          ) : error ? (
            <div className="h-full flex items-center justify-center text-red-600 text-sm">{error}</div>
          ) : images.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400"><PhotoIcon className="w-12 h-12 opacity-40" /><p className="text-sm mt-2">No images for this generation.</p></div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
              {images.map((img, idx) => {
                const isSel = sel[tab].has(img.id)
                const inOther = sel[otherTab].has(img.id)
                const enhanced = isEnhancedImage(img)
                return (
                  <div
                    key={img.id}
                    onClick={() => toggle(img.id)}
                    className={cn(
                      'group relative rounded-xl overflow-hidden aspect-[4/3] cursor-pointer transition-all ring-2 shadow-sm',
                      isSel ? `${activeTab.ring} shadow-md scale-[0.98]` : 'ring-transparent hover:ring-gray-300',
                      locked && 'cursor-not-allowed opacity-80'
                    )}
                    style={bgStyle}
                  >
                    {img.url && !broken.has(img.id) ? (
                      <img
                        src={img.url} alt={img.file_name} loading="lazy"
                        onError={() => setBroken((b) => new Set(b).add(img.id))}
                        className={cn('w-full h-full object-contain p-1.5 transition-transform duration-300', !isSel && 'group-hover:scale-105')}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300"><PhotoIcon className="w-10 h-10" /></div>
                    )}

                    <div className={cn('absolute inset-0 pointer-events-none transition-colors', isSel ? 'bg-black/0' : 'group-hover:bg-black/10')} />

                    {/* Checkbox badge */}
                    <div className={cn(
                      'absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all shadow',
                      isSel ? `${activeTab.chip} border-white text-white` : 'bg-black/35 border-white/80 text-transparent group-hover:text-white/70'
                    )}>
                      <CheckIcon className="w-3.5 h-3.5" strokeWidth={3} />
                    </div>

                    {/* Action buttons on card hover */}
                    <div className="absolute top-2 right-2 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      {/* Download */}
                      <button
                        title="Download image"
                        onClick={(e) => downloadImage(img, e)}
                        disabled={downloadingId === img.id}
                        className="p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/85 disabled:opacity-50 shadow-sm"
                      >
                        {downloadingId === img.id ? (
                          <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                        )}
                      </button>
                      {/* Preview / Inspect on BG */}
                      <button
                        title="Preview with BG switcher" onClick={(e) => { e.stopPropagation(); setPreview(idx) }}
                        className="p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/85 shadow-sm"
                      ><ArrowsPointingOutIcon className="w-3.5 h-3.5" /></button>
                      {/* Add Enhanced Version alongside */}
                      <button
                        title="Add enhanced version alongside (keeps original)" onClick={(e) => { e.stopPropagation(); startUpload(img, 'enhanced') }}
                        className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                      ><SparklesIcon className="w-3.5 h-3.5" /></button>
                      {/* Replace */}
                      <button
                        title="Replace this image" onClick={(e) => { e.stopPropagation(); startUpload(img, 'replace') }}
                        className="p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/85 shadow-sm"
                      ><ArrowUpTrayIcon className="w-3.5 h-3.5" /></button>
                    </div>

                    {/* Footer chips */}
                    <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-end justify-between gap-1 pointer-events-none">
                      <span className="text-[10px] text-white/95 truncate font-medium">#{idx + 1} · {formatBytes(img.file_size)}</span>
                      <div className="flex flex-wrap items-center gap-1">
                        {enhanced ? (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500 text-[9px] font-bold text-white shadow-sm flex items-center gap-0.5">
                            <SparklesIcon className="w-2.5 h-2.5 inline" /> Enhanced
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-slate-800/90 text-[9px] font-medium text-white/90">
                            Original
                          </span>
                        )}
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

        {/* Upload confirmation dialog (Enhanced alongside OR Replace) */}
        {pending && (
          <div className="absolute inset-0 z-30 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={uploading ? undefined : cancelPending}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  {pending.mode === 'enhanced' ? (
                    <>
                      <SparklesIcon className="w-5 h-5 text-emerald-600" />
                      Add Enhanced Image Alongside Original
                    </>
                  ) : (
                    <>
                      <ArrowUpTrayIcon className="w-5 h-5 text-amber-600" />
                      Replace Existing Image
                    </>
                  )}
                </h3>
                <button onClick={cancelPending} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100">
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Upload Mode Switcher */}
              <div className="flex rounded-lg bg-gray-100 p-1 gap-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setPending((p) => (p ? { ...p, mode: 'enhanced' } : null))}
                  className={cn(
                    'flex-1 py-1.5 px-3 rounded-md transition-all flex items-center justify-center gap-1.5',
                    pending.mode === 'enhanced' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  <SparklesIcon className="w-3.5 h-3.5" />
                  Add Alongside (Side-by-Side)
                </button>
                <button
                  type="button"
                  onClick={() => setPending((p) => (p ? { ...p, mode: 'replace' } : null))}
                  className={cn(
                    'flex-1 py-1.5 px-3 rounded-md transition-all flex items-center justify-center gap-1.5',
                    pending.mode === 'replace' ? 'bg-amber-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  <ArrowUpTrayIcon className="w-3.5 h-3.5" />
                  Replace Directly
                </button>
              </div>

              {/* Side-by-side preview with background color test */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-1">Original Reference</p>
                  <div className="aspect-[4/3] rounded-lg overflow-hidden border border-gray-200" style={bgStyle}>
                    {pending.image.url && <img src={pending.image.url} className="w-full h-full object-contain p-1" alt="current" />}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-1">New Upload Preview</p>
                  <div className="aspect-[4/3] rounded-lg overflow-hidden border border-gray-200" style={bgStyle}>
                    <img src={pending.localUrl} className="w-full h-full object-contain p-1" alt="new" />
                  </div>
                </div>
              </div>

              {/* Background Color Quick Selector inside dialog */}
              <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-gray-100">
                <span className="text-xs text-gray-500 font-medium">Test background color:</span>
                {renderBgSwitcher()}
              </div>

              {/* Informative notice */}
              <div className={cn(
                'flex gap-2 rounded-lg p-3 text-xs leading-relaxed border',
                pending.mode === 'enhanced' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-800'
              )}>
                {pending.mode === 'enhanced' ? (
                  <>
                    <SparklesIcon className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-600" />
                    <span>
                      The original image will <b>NOT</b> be replaced. The enhanced image will be stored in S3 alongside it, and both will appear in the gallery so you can compare and select either one.
                    </span>
                  </>
                ) : (
                  <>
                    <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{SHARED_NOTICE}</span>
                  </>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button onClick={cancelPending} disabled={uploading} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
                <button
                  onClick={confirmUpload} disabled={uploading}
                  className={cn(
                    'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow transition-all disabled:opacity-60',
                    pending.mode === 'enhanced' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'
                  )}
                >
                  {uploading ? (
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  ) : pending.mode === 'enhanced' ? (
                    <SparklesIcon className="w-4 h-4" />
                  ) : (
                    <ArrowUpTrayIcon className="w-4 h-4" />
                  )}
                  {pending.mode === 'enhanced' ? 'Save alongside original' : 'Replace in both'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lightbox / Full-screen Image Inspector with BG preview */}
        {previewImg && (
          <div
            className="absolute inset-0 z-40 bg-black/92 flex flex-col items-center justify-center"
            onClick={() => setPreview(null)}
          >
            {/* Top bar with file name, BG Switcher, and controls */}
            <div className="absolute top-0 inset-x-0 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent z-10 gap-3" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2 min-w-0">
                <p className="text-xs text-white/90 font-medium truncate max-w-xs">{previewImg.file_name}</p>
                {isEnhancedImage(previewImg) ? (
                  <span className="px-2 py-0.5 rounded bg-emerald-500 text-[10px] font-bold text-white shadow-sm flex items-center gap-1">
                    <SparklesIcon className="w-3 h-3" /> Enhanced
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-slate-700 text-[10px] font-medium text-white/90">
                    Original
                  </span>
                )}
              </div>

              {/* Background Color Switcher inside Lightbox */}
              <div className="flex items-center gap-2">
                {renderBgSwitcher()}

                {/* Download */}
                <button
                  type="button"
                  title="Download image"
                  disabled={downloadingId === previewImg.id}
                  className="p-2 rounded-full bg-white/10 text-white hover:bg-white/25 transition-colors disabled:opacity-50"
                  onClick={(e) => downloadImage(previewImg, e)}
                >
                  {downloadingId === previewImg.id ? (
                    <ArrowPathIcon className="w-5 h-5 animate-spin" />
                  ) : (
                    <ArrowDownTrayIcon className="w-5 h-5" />
                  )}
                </button>
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

            {/* Image center container with selected background color */}
            <div
              className="w-full h-full flex items-center justify-center p-12 sm:p-20 transition-all duration-200"
              style={bgStyle}
              onClick={(e) => e.stopPropagation()}
            >
              {previewImg.url && (
                <img
                  src={previewImg.url}
                  alt={previewImg.file_name}
                  className="max-w-full max-h-full w-auto h-auto object-contain rounded-lg drop-shadow-2xl transition-all"
                  style={{ maxWidth: '92%', maxHeight: '85%' }}
                />
              )}
            </div>

            {/* Bottom counter */}
            <div className="absolute bottom-4 inset-x-0 flex items-center justify-center gap-2 pointer-events-none">
              <span className="text-xs text-white/90 bg-black/60 px-3.5 py-1.5 rounded-full backdrop-blur-sm shadow">
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
