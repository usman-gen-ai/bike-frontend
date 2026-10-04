import { ArrowPathIcon, ExclamationTriangleIcon, SparklesIcon, XMarkIcon } from '@heroicons/react/24/outline'
import type { VideoOrientation, VideoQuality } from '@lib/api'
import { cn } from '@lib/utils'
import { MAX_GENERATIONS, QUALITIES, estimateSeconds, formatDuration, type PickedGen, type PickedMap } from './types'


interface Props {
  picked: PickedMap
  onRemove: (ids: number[]) => void
  onClear: () => void
  orientation: VideoOrientation
  quality: VideoQuality
  creating: boolean
  onOrientation: (o: VideoOrientation) => void
  onQuality: (q: VideoQuality) => void
  onGenerate: () => void
}

const Shape = ({ portrait, active }: { portrait?: boolean; active: boolean }) => (
  <span
    className={cn(
      'block rounded-[5px] border-2 transition-colors',
      portrait ? 'w-6 h-10' : 'w-11 h-6',
      active ? 'border-[#ff5a36] bg-[#ff5a36]/15' : 'border-slate-300 bg-slate-100'
    )}
  />
)

export const OutputPanel = ({ picked, onRemove, onClear, orientation, quality, creating, onOrientation, onQuality, onGenerate }: Props) => {
  const q = QUALITIES.find((x) => x.value === quality)!
  const list = Object.values(picked)
  const groups = Object.values(
    list.reduce<Record<number, { pmName: string; mainName: string; items: PickedGen[] }>>((acc, g) => {
      ;(acc[g.pmId] ||= { pmName: g.pmName, mainName: g.mainName, items: [] }).items.push(g)
      return acc
    }, {})
  ).sort((x, y) => x.pmName.localeCompare(y.pmName))
  const seconds = estimateSeconds([...list].sort((x, y) => x.pmName.localeCompare(y.pmName) || x.title.localeCompare(y.title)))
  const tooMany = list.length > MAX_GENERATIONS
  const disabled = list.length === 0 || tooMany || creating

  return (
    <div className="space-y-5">
      {/* selection summary */}
      <div className={cn('rounded-xl border text-sm', list.length ? 'bg-slate-900 border-slate-900 text-white' : 'bg-slate-50 border-dashed border-slate-300 text-slate-400')}>
        {list.length ? (
          <>
            <div className="flex items-start justify-between gap-2 px-3.5 pt-3">
              <div>
                <p className="font-display font-bold text-base leading-none">{list.length} generation{list.length === 1 ? '' : 's'}</p>
                <p className="mt-1 text-xs text-slate-300">{groups.length} production model{groups.length === 1 ? '' : 's'} · ≈ {formatDuration(seconds)} video</p>
              </div>
              <button type="button" onClick={onClear} className="text-[11px] font-semibold text-[#ff9b82] hover:text-white">Clear all</button>
            </div>
            <ul className="mt-2.5 max-h-52 overflow-y-auto border-t border-white/10 divide-y divide-white/10">
              {groups.map((g) => (
                <li key={g.items[0].pmId} className="px-3.5 py-2 flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold truncate">{g.pmName}</p>
                    <p className="text-[11px] text-slate-400 truncate">{g.mainName} · {g.items.length} gen: {g.items.slice(0, 2).map((i) => i.title).join(', ')}{g.items.length > 2 ? '…' : ''}</p>
                  </div>
                  <button type="button" onClick={() => onRemove(g.items.map((i) => i.id))} aria-label={`Remove ${g.pmName}`} className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10">
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="px-3.5 py-3">Tick items in the left panel: a whole main model, one or more production models, or just a few generations.</p>
        )}
      </div>

      {/* orientation */}
      <div>
        <p className="text-xs font-semibold text-slate-600 mb-2">Orientation</p>
        <div className="grid grid-cols-2 gap-2.5">
          {([['landscape', 'Landscape', '16:9 · YouTube'], ['portrait', 'Portrait', '9:16 · Shorts']] as const).map(([val, name, hint]) => {
            const on = orientation === val
            return (
              <button
                key={val} type="button" onClick={() => onOrientation(val)} aria-pressed={on}
                className={cn(
                  'flex flex-col items-center justify-end gap-2 rounded-xl border-2 px-2 pt-3 pb-2.5 h-[7.5rem] transition-all',
                  on ? 'border-[#ff5a36] bg-white shadow-md -translate-y-0.5' : 'border-slate-200 bg-white hover:border-slate-300'
                )}
              >
                <span className="flex-1 grid place-items-center"><Shape portrait={val === 'portrait'} active={on} /></span>
                <span className="text-center">
                  <span className="block text-sm font-bold text-slate-900 leading-none">{name}</span>
                  <span className="block text-[11px] text-slate-500 mt-1">{hint}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* quality */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-xs font-semibold text-slate-600">Quality</p>
          <p className="text-[11px] text-slate-500 tabular-nums">{orientation === 'landscape' ? q.land : q.port}</p>
        </div>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Video quality">
          {QUALITIES.map((x) => {
            const on = quality === x.value
            return (
              <button
                key={x.value} type="button" role="radio" aria-checked={on} onClick={() => onQuality(x.value)}
                className={cn(
                  'h-10 rounded-lg text-sm font-bold border transition-colors',
                  on ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-700 hover:border-slate-400'
                )}
              >
                {x.label}
                {x.value === '720p' && <span className={cn('ml-1 text-[9px] font-semibold', on ? 'text-[#ff9b82]' : 'text-slate-400')}>default</span>}
              </button>
            )
          })}
        </div>
        {q.heavy && (
          <p className="mt-2 flex gap-1.5 text-[11px] text-amber-700 bg-amber-50 ring-1 ring-amber-200 rounded-lg px-2.5 py-2 leading-snug">
            <ExclamationTriangleIcon className="w-4 h-4 shrink-0" />
            {q.label} rendering is very heavy (high RAM/CPU and a long wait). 720p/1080p is enough for normal use.
          </p>
        )}
      </div>

      {tooMany && (
        <p className="text-xs text-red-700 bg-red-50 ring-1 ring-red-200 rounded-lg px-3 py-2">
          A video can include at most {MAX_GENERATIONS} generations. Please remove some.
        </p>
      )}

      <button
        type="button" onClick={onGenerate} disabled={disabled}
        className={cn(
          'relative overflow-hidden w-full h-12 rounded-xl font-display font-bold text-base inline-flex items-center justify-center gap-2 transition-all',
          disabled ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-[#ff5a36] text-white hover:bg-[#e8431f] shadow-lg shadow-[#ff5a36]/30 active:translate-y-px',
          creating && 'anim-sweep'
        )}
      >
        {creating ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <SparklesIcon className="w-5 h-5" />}
        {creating ? 'Adding to queue…' : list.length > 1 ? `Generate Video (${list.length} gen)` : 'Generate Video'}
      </button>
    </div>
  )
}
