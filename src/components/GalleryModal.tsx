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
  ViewColumnsIcon,
  RectangleStackIcon,
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
import { CanvasImageCompositor, type CanvasImageCompositorHandle } from './CanvasImageCompositor'

interface Props {
  generation: GenerationItem
  onClose: () => void
  onStateChange: (id: number, state: Partial<GenerationAssetState>) => void
  notify: (kind: 'success' | 'error' | 'info', message: string, ms?: number) => void
}

const sameSet = (a: Set<number>, b: Set<number>) => a.size === b.size && [...a].every((x) => b.has(x))

const TABS: { target: AssetTarget; label: string; icon: typeof PhotoIcon; active: string; ring: string; chip: string }[] = [
  { target: 'video', label: 'Video Images', icon: VideoCameraIcon, active: 'bg-blue-600 text-white shadow-md', ring: 'ring-blue-500', chip: 'bg-blue-600' },
  { target: 'thumbnail', label: 'Thumbnail Images', icon: PhotoIcon, active: 'bg-amber-500 text-white shadow-md', ring: 'ring-amber-500', chip: 'bg-amber-500' },
]

type BgChoice = 'checker' | 'white' | 'black' | 'dark' | 'light' | 'blue' | 'custom'

const PRESET_COLORS: Record<string, string> = {
  white: '#ffffff',
  black: '#000000',
  dark: '#0f172a',
  light: '#f1f5f9',
  blue: '#1e40af',
}

const isEnhancedImage = (img: GalleryImage): boolean => img.is_replaced

export const GalleryModal = ({ generation, onClose, onStateChange, notify }: Props) => {
  const [images, setImages] = useState<GalleryImage[]>([])
  const [state, setState] = useState<GenerationAssetState>(generation)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [tab, setTab] = useState<AssetTarget>('video')
  const [sel, setSel] = useState<Record<AssetTarget, Set<number>>>({ video: new Set(), thumbnail: new Set() })
  const [saved, setSaved] = useState<Record<AssetTarget, Set<number>>>({ video: new Set(), thumbnail: new Set() })
  const [saving, setSaving] = useState(false)

  // Background color preview state for Canvas Image Compositor
  const [bgChoice, setBgChoice] = useState<BgChoice>('checker')
  const [customBgColor, setCustomBgColor] = useState('#2563eb')

  const [preview, setPreview] = useState<number | null>(null) // index in images
  const [viewMode, setViewMode] = useState<'split' | 'single'>('split')
  const [pending, setPending] = useState<{ image: GalleryImage; file: File; localUrl: string; mode: 'enhanced' } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [broken, setBroken] = useState<Set<number>>(new Set())
  const [downloadingId, setDownloadingId] = useState<number | null>(null)

  const fileInput = useRef<HTMLInputElement>(null)
  const uploadTarget = useRef<{ image: GalleryImage; mode: 'enhanced' } | null>(null)
  const canvasRef = useRef<CanvasImageCompositorHandle>(null)

  // Real canvas background color string passed into CanvasImageCompositor
  const activeBgColor = useMemo(() => {
    if (bgChoice === 'checker') return 'checker'
    if (bgChoice === 'custom') return customBgColor
    return PRESET_COLORS[bgChoice] || '#ffffff'
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
  const startUpload = (img: GalleryImage, mode: 'enhanced' = 'enhanced') => {
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
      const res = await adminApi.addEnhancedImage(pending.image.id, pending.file)
      setImages((list) => list.map((i) => (i.id === res.image.id ? res.image : i)))
      setBroken((b) => { const n = new Set(b); n.delete(res.image.id); return n })
      notify('success', 'Enhanced image saved. Left = original, right = enhanced. Video/thumbnail will use the enhanced one.', 7000)
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

  // Determine if active preview image has a separate original version for side-by-side comparison
  const hasOriginal = useMemo(() => {
    if (!previewImg) return false
    return Boolean(previewImg.is_replaced && previewImg.original_url)
  }, [previewImg])

  // Background palette switcher component (operates on the real HTML5 Canvas)
  const renderBgSwitcher = (darkTheme = false) => (
    <div className={cn(
      'inline-flex items-center gap-1.5 p-1 rounded-xl text-xs transition-colors',
      darkTheme ? 'bg-white/10 backdrop-blur-md border border-white/15' : 'bg-gray-100/90 border border-gray-200/80 shadow-sm'
    )}>
      <span className={cn('text-[11px] font-semibold px-1 flex items-center gap-1', darkTheme ? 'text-white/80' : 'text-gray-500')}>
        <SwatchIcon className="w-3.5 h-3.5 text-gray-400" /> BG:
      </span>

      {/* Transparent Checkerboard */}
      <button
        type="button"
        title="Transparent (Checkerboard Canvas Pattern)"
        onClick={() => setBgChoice('checker')}
        className={cn(
          'w-6 h-6 rounded-lg border text-[10px] font-bold transition-all shadow-sm',
          bgChoice === 'checker' ? 'ring-2 ring-emerald-400 border-white scale-105' : 'border-gray-400/50 opacity-80 hover:opacity-100'
        )}
        style={{
          backgroundImage: `linear-gradient(45deg, #cbd5e1 25%, transparent 25%), linear-gradient(-45deg, #cbd5e1 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #cbd5e1 75%), linear-gradient(-45deg, transparent 75%, #cbd5e1 75%)`,
          backgroundSize: '8px 8px',
          backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0',
          backgroundColor: '#ffffff',
        }}
      />

      {/* Pure White */}
      <button
        type="button"
        title="Pure White Background"
        onClick={() => setBgChoice('white')}
        className={cn(
          'w-6 h-6 rounded-lg border-2 bg-white transition-all shadow-sm',
          bgChoice === 'white' ? 'ring-2 ring-emerald-400 border-emerald-400 scale-105' : 'border-gray-400 opacity-100 hover:scale-105'
        )}
      />

      {/* Deep Black */}
      <button
        type="button"
        title="Deep Black Background"
        onClick={() => setBgChoice('black')}
        className={cn(
          'w-6 h-6 rounded-lg border bg-black transition-all shadow-sm',
          bgChoice === 'black' ? 'ring-2 ring-emerald-400 border-white scale-105' : 'border-neutral-700 opacity-80 hover:opacity-100'
        )}
      />

      {/* Dark Slate Studio */}
      <button
        type="button"
        title="Dark Slate Studio (#0F172A)"
        onClick={() => setBgChoice('dark')}
        className={cn(
          'w-6 h-6 rounded-lg border bg-slate-900 transition-all shadow-sm',
          bgChoice === 'dark' ? 'ring-2 ring-emerald-400 border-white scale-105' : 'border-neutral-700 opacity-80 hover:opacity-100'
        )}
      />

      {/* Soft Light Studio */}
      <button
        type="button"
        title="Soft Light Studio (#F1F5F9)"
        onClick={() => setBgChoice('light')}
        className={cn(
          'w-6 h-6 rounded-lg border bg-slate-200 transition-all shadow-sm',
          bgChoice === 'light' ? 'ring-2 ring-emerald-400 border-emerald-400 scale-105' : 'border-gray-300 opacity-80 hover:opacity-100'
        )}
      />

      {/* Studio Blue */}
      <button
        type="button"
        title="Studio Blue (#1E40AF)"
        onClick={() => setBgChoice('blue')}
        className={cn(
          'w-6 h-6 rounded-lg border bg-blue-700 transition-all shadow-sm',
          bgChoice === 'blue' ? 'ring-2 ring-emerald-400 border-white scale-105' : 'border-transparent opacity-80 hover:opacity-100'
        )}
      />

      {/* Custom Color */}
      <label
        title="Custom Color (Pick any color)"
        className={cn(
          'w-6 h-6 rounded-lg border cursor-pointer relative overflow-hidden transition-all shadow-sm flex items-center justify-center',
          bgChoice === 'custom' ? 'ring-2 ring-emerald-400 border-white scale-105' : 'border-gray-400/50 opacity-80 hover:opacity-100'
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
              <span className="text-xs text-gray-400">{images.length} images · enhanced ones show original vs enhanced</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" aria-label="Close">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs bar */}
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

          <div className="text-xs text-gray-400 hidden sm:block">
            Click any image to inspect side-by-side with canvas background
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-5 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 border-b border-gray-100">
          <p className="text-xs text-gray-500">
            Select images for <b>{tab}</b>. Enhanced images show original (left) vs enhanced (right) in the preview.
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
                const isReplaced = img.is_replaced || enhanced
                return (
                  <div
                    key={img.id}
                    onClick={() => toggle(img.id)}
                    className={cn(
                      'group relative rounded-xl overflow-hidden aspect-[4/3] cursor-pointer transition-all ring-2 shadow-sm bg-slate-100',
                      isSel ? `${activeTab.ring} shadow-md scale-[0.98]` : 'ring-transparent hover:ring-gray-300',
                      locked && 'cursor-not-allowed opacity-80'
                    )}
                  >
                    {img.url && !broken.has(img.id) ? (
                      <img
                        src={img.url} alt={img.file_name} loading="lazy"
                        onError={() => setBroken((b) => new Set(b).add(img.id))}
                        className={cn('w-full h-full object-contain p-2 transition-transform duration-300', !isSel && 'group-hover:scale-105')}
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
                      {/* Preview / Side-by-Side Comparison */}
                      <button
                        title="Inspect side-by-side & canvas background"
                        onClick={(e) => { e.stopPropagation(); setPreview(idx); setViewMode('split') }}
                        className="p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/85 shadow-sm"
                      ><ArrowsPointingOutIcon className="w-3.5 h-3.5" /></button>
                      {/* Add Enhanced Version alongside */}
                      <button
                        title="Add enhanced version alongside (keeps original)"
                        onClick={(e) => { e.stopPropagation(); startUpload(img, 'enhanced') }}
                        className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                      ><SparklesIcon className="w-3.5 h-3.5" /></button>
                    </div>

                    {/* Upload Enhanced Image: bottom-left, just above the footer chips */}
                    <button
                      title="Upload enhanced image"
                      onClick={(e) => { e.stopPropagation(); startUpload(img, 'enhanced') }}
                      className="absolute bottom-9 left-2 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-600 text-white text-[10px] font-semibold hover:bg-violet-700 shadow-sm opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                    ><ArrowUpTrayIcon className="w-3.5 h-3.5" /> Upload</button>

                    {/* Footer chips */}
                    <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-end justify-between gap-1 pointer-events-none">
                      <span className="text-[10px] text-white/95 truncate font-medium">#{idx + 1} · {formatBytes(img.file_size)}</span>
                      <div className="flex flex-wrap items-center gap-1">
                        {isReplaced ? (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-[9px] font-bold text-white shadow-sm flex items-center gap-0.5">
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
          <div className="absolute inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={uploading ? undefined : cancelPending}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <SparklesIcon className="w-5 h-5 text-emerald-600" />
                  Upload Enhanced Image
                </h3>
                <button onClick={cancelPending} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100">
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Explanation notice */}
              <div className="p-3 rounded-xl text-xs space-y-1 bg-emerald-50 text-emerald-900 border border-emerald-200">
                <p className="font-bold">Enhanced version (same card)</p>
                <p className="text-[11px] leading-relaxed">
                  The enhanced image takes this card's place and is the one used for video / thumbnail. The untouched original stays safely in S3 and is shown on the LEFT in the preview, enhanced on the RIGHT.
                </p>
              </div>

              {/* Preview Comparison */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Current Image</p>
                  <div className="aspect-[4/3] rounded-xl overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center p-1">
                    <img src={pending.image.url || ''} alt="Current" className="w-full h-full object-contain" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                    New Enhanced Image
                  </p>
                  <div className="aspect-[4/3] rounded-xl overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center p-1">
                    <img src={pending.localUrl} alt="New upload" className="w-full h-full object-contain" />
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={cancelPending}
                  disabled={uploading}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmUpload}
                  disabled={uploading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white shadow-sm transition-all bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60"
                >
                  {uploading ? (
                    <>
                      <ArrowPathIcon className="w-4 h-4 animate-spin" /> Uploading to S3…
                    </>
                  ) : (
                    <>
                      <SparklesIcon className="w-4 h-4" /> Save Enhanced Version
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── LIGHTBOX / SIDE-BY-SIDE SPLIT SCREEN COMPARISON MODAL ── */}
        {previewImg && (
          <div
            className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-between"
            onClick={() => setPreview(null)}
          >
            {/* Top Navigation & Controls Bar */}
            <div
              className="w-full flex items-center justify-between px-4 sm:px-6 py-3 bg-black/80 border-b border-white/10 z-10 gap-3"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Left: File Info & Badge */}
              <div className="flex items-center gap-2.5 min-w-0">
                <p className="text-xs sm:text-sm text-white font-medium truncate max-w-xs sm:max-w-md">
                  {previewImg.file_name}
                </p>
                {previewImg.is_replaced || isEnhancedImage(previewImg) ? (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/90 text-[10px] font-bold text-white shadow-sm flex items-center gap-1">
                    <SparklesIcon className="w-3 h-3" /> Enhanced / Replaced
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-slate-700 text-[10px] font-medium text-white/90">
                    Original
                  </span>
                )}
              </div>

              {/* Center: Split View vs Single View Mode Switcher (when original exists) */}
              {hasOriginal && (
                <div className="hidden sm:inline-flex items-center p-0.5 rounded-lg bg-white/10 border border-white/10 text-xs">
                  <button
                    type="button"
                    onClick={() => setViewMode('split')}
                    className={cn(
                      'px-3 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5',
                      viewMode === 'split' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
                    )}
                  >
                    <ViewColumnsIcon className="w-3.5 h-3.5" /> Side-by-Side Comparison
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('single')}
                    className={cn(
                      'px-3 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5',
                      viewMode === 'single' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
                    )}
                  >
                    <RectangleStackIcon className="w-3.5 h-3.5" /> Single Focus
                  </button>
                </div>
              )}

              {/* Right: Background switcher & Action buttons */}
              <div className="flex items-center gap-2">
                {/* BG Switcher directly in top bar for quick access */}
                {renderBgSwitcher(true)}

                {/* Direct Download */}
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
                  type="button"
                  title="Close preview (Esc)"
                  className="p-2 rounded-full bg-white/10 text-white hover:bg-white/25 transition-colors"
                  onClick={() => setPreview(null)}
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Prev / Next navigation arrows */}
            {images.length > 1 && (
              <>
                <button
                  title="Previous image (Left arrow)"
                  className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 p-2.5 sm:p-3 rounded-full bg-black/60 text-white hover:bg-black/85 border border-white/20 transition-all shadow-xl"
                  onClick={(e) => { e.stopPropagation(); setPreview((preview! - 1 + images.length) % images.length) }}
                >
                  <ChevronLeftIcon className="w-6 h-6" />
                </button>
                <button
                  title="Next image (Right arrow)"
                  className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 p-2.5 sm:p-3 rounded-full bg-black/60 text-white hover:bg-black/85 border border-white/20 transition-all shadow-xl"
                  onClick={(e) => { e.stopPropagation(); setPreview((preview! + 1) % images.length) }}
                >
                  <ChevronRightIcon className="w-6 h-6" />
                </button>
              </>
            )}

            {/* ── Main Comparison / Preview Area ── */}
            <div
              className="flex-1 w-full flex items-center justify-center p-3 sm:p-6 overflow-hidden min-h-0"
              onClick={(e) => e.stopPropagation()}
            >
              {hasOriginal && viewMode === 'split' ? (
                /* SPLIT-SCREEN SIDE-BY-SIDE VIEW: Left = Original, Right = Replaced with Canvas Compositor */
                <div className="w-full h-full flex flex-col md:flex-row gap-4 items-stretch justify-center max-w-7xl">
                  {/* Left Column: Original Image (Before) */}
                  <div className="flex-1 flex flex-col bg-zinc-900/95 rounded-2xl border border-white/10 overflow-hidden shadow-2xl min-h-0">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-black/60 border-b border-white/10">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
                        <span className="text-xs font-bold text-white tracking-wider uppercase">
                          Original Image (Before)
                        </span>
                      </div>
                      <button
                        type="button"
                        title="Download original untouched image"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-medium transition-colors"
                        onClick={() => {
                          const a = document.createElement('a')
                          a.href = previewImg.original_url!
                          a.download = `original-${previewImg.file_name.replace(/\.[^/.]+$/, '.jpg')}`
                          a.target = '_blank'
                          a.click()
                        }}
                      >
                        <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                        Download Original
                      </button>
                    </div>

                    <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden bg-black/40">
                      <img
                        src={previewImg.original_url!}
                        alt="Original (Before)"
                        className="max-w-full max-h-full object-contain rounded-lg shadow-xl"
                      />
                    </div>
                  </div>

                  {/* Right Column: Replaced / Enhanced Image with REAL CANVAS BACKGROUND COMPOSITING */}
                  <div className="flex-1 flex flex-col bg-zinc-900/95 rounded-2xl border border-white/10 overflow-hidden shadow-2xl min-h-0">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-black/60 border-b border-white/10 gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span className="text-xs font-bold text-emerald-400 tracking-wider uppercase flex items-center gap-1.5">
                          <SparklesIcon className="w-3.5 h-3.5" /> Replaced / Enhanced (After)
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Download canvas composited image button */}
                        <button
                          type="button"
                          title="Download cutout with chosen background directly as file"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-medium transition-colors shadow-sm"
                          onClick={() => canvasRef.current?.downloadComposited(`canvas-${previewImg.file_name}`)}
                        >
                          <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                          Download with BG
                        </button>
                      </div>
                    </div>

                    {/* Canvas image container: Background is drawn on the image canvas itself, NO outer div styling! */}
                    <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden bg-black/40">
                      {previewImg.url && (
                        <CanvasImageCompositor
                          ref={canvasRef}
                          src={previewImg.url}
                          bgColor={activeBgColor}
                          alt={previewImg.file_name}
                        />
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* SINGLE VIEW (or image without a separate original) */
                <div className="w-full h-full flex flex-col items-center justify-center max-w-5xl bg-zinc-900/80 rounded-2xl border border-white/10 p-4 overflow-hidden relative">
                  {/* If image is a cutout or enhanced, render on Canvas compositor */}
                  {isEnhancedImage(previewImg) ? (
                    <CanvasImageCompositor
                      ref={canvasRef}
                      src={previewImg.url!}
                      bgColor={activeBgColor}
                      alt={previewImg.file_name}
                    />
                  ) : (
                    <img
                      src={previewImg.url!}
                      alt={previewImg.file_name}
                      className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                    />
                  )}
                </div>
              )}
            </div>

            {/* Bottom info bar */}
            <div className="w-full flex items-center justify-between px-6 py-2.5 bg-black/80 border-t border-white/10 text-xs text-slate-400 pointer-events-auto">
              <div>
                <span>Image {preview! + 1} of {images.length}</span>
                {previewImg.file_size ? ` · ${formatBytes(previewImg.file_size)}` : ''}
                {previewImg.mime_type ? ` · ${previewImg.mime_type}` : ''}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => startUpload(previewImg, 'enhanced')}
                  className="px-3 py-1 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 text-white font-medium transition-colors flex items-center gap-1"
                >
                  <SparklesIcon className="w-3.5 h-3.5" /> Add Enhanced Version
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
