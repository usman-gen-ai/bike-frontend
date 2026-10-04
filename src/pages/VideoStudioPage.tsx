import { useCallback, useState, type ReactNode } from 'react'
import { adminApi, getErrorMessage, type VideoOrientation, type VideoQuality } from '@lib/api'
import { AppHeader } from '@components/AppHeader'
import { ToastHost, useToasts } from '@components/Toast'
import { SourcePicker } from '@components/video/SourcePicker'
import { OutputPanel } from '@components/video/OutputPanel'
import { VideoLibrary } from '@components/video/VideoLibrary'
import { DEFAULT_ORIENTATION, DEFAULT_QUALITY, type PickedMap } from '@components/video/types'

const Panel = ({ step, title, hint, children, className = '' }: { step?: number; title: string; hint?: string; children: ReactNode; className?: string }) => (
  <section className={`rounded-2xl bg-white border border-slate-200 shadow-sm p-4 sm:p-5 min-w-0 ${className}`}>
    <div className="flex items-center gap-2.5 mb-4">
      {step && <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-bold grid place-items-center">{step}</span>}
      <div>
        <h2 className="font-display text-lg font-extrabold text-slate-900 leading-none">{title}</h2>
        {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
      </div>
    </div>
    {children}
  </section>
)

export const VideoStudioPage = () => {
  const { toasts, notify, dismiss } = useToasts()
  const [picked, setPicked] = useState<PickedMap>({})
  const [orientation, setOrientation] = useState<VideoOrientation>(DEFAULT_ORIENTATION)
  const [quality, setQuality] = useState<VideoQuality>(DEFAULT_QUALITY)
  const [creating, setCreating] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const onError = useCallback((m: string) => notify('error', m), [notify])

  const removeIds = useCallback((ids: number[]) => setPicked((prev) => {
    const next = { ...prev }
    ids.forEach((id) => delete next[id])
    return next
  }), [])

  const generate = async () => {
    const ids = Object.keys(picked).map(Number)
    if (ids.length === 0) return
    setCreating(true)
    try {
      const { video, skipped_generations } = await adminApi.createVideo({
        ...(ids.length === 1 ? { scope: 'generation' as const, target_id: ids[0] } : { scope: 'custom' as const, generation_ids: ids }),
        orientation, quality,
      })
      notify('success', `Video #${video.id} is queued (${orientation}, ${quality}).`)
      if (skipped_generations.length) {
        notify('info', `${skipped_generations.length} generation(s) skipped: ${skipped_generations.slice(0, 2).map((s) => s.title).join(', ')}${skipped_generations.length > 2 ? '…' : ''}`, 8000)
      }
      setPicked({})
      setRefreshKey((k) => k + 1)
    } catch (e) {
      notify('error', getErrorMessage(e))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 pt-14">
      <AppHeader />

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 pb-16">
        <div className="mb-5">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-900">Video Studio</h1>
          <p className="text-sm text-slate-500 mt-1">Choose models, pick a format, and generate videos from the backend.</p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-[23rem_21rem_minmax(0,1fr)] items-start">
          <Panel step={1} title="Source" hint="Tick brands, models or generations">
            <SourcePicker picked={picked} onPickedChange={(fn) => setPicked(fn)} onError={onError} />
          </Panel>

          <Panel step={2} title="Format" hint="Orientation and quality">
            <OutputPanel
              picked={picked} onRemove={removeIds} onClear={() => setPicked({})} orientation={orientation} quality={quality} creating={creating}
              onOrientation={setOrientation} onQuality={setQuality} onGenerate={generate}
            />
          </Panel>

          <Panel title="Generated videos" hint="Newest first" className="md:col-span-2 xl:col-span-1">
            <VideoLibrary refreshKey={refreshKey} notify={notify} />
          </Panel>
        </div>
      </main>

      <ToastHost toasts={toasts} dismiss={dismiss} />
    </div>
  )
}

export default VideoStudioPage
