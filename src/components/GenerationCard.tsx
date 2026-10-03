import { useState } from 'react'
import {
  ArrowPathIcon,
  CheckIcon,
  ChevronDownIcon,
  PhotoIcon,
  VideoCameraIcon,
} from '@heroicons/react/24/outline'
import type { AssetStatus, AssetTarget, GenerationItem } from '@lib/api'
import { cn } from '@lib/utils'
import { AssetBadge, StatusBadge } from './StatusBadges'
import { GenerationSpecs } from './GenerationSpecs'

interface Props {
  generation: GenerationItem
  busyTarget: AssetTarget | null
  onOpenGallery: () => void
  onMarkReady: (target: AssetTarget) => void
}

const readyLabel = (target: AssetTarget, status: AssetStatus): string => {
  const noun = target === 'video' ? 'Video' : 'Thumbnail'
  switch (status) {
    case 'ready': return `${noun} Ready`
    case 'processing': return `${noun} Processing`
    case 'completed': return `${noun} Done`
    default: return `Ready for ${noun}`
  }
}

const disabledReason = (g: GenerationItem, target: AssetTarget): string | undefined => {
  const status = target === 'video' ? g.video_status : g.thumbnail_status
  const selected = target === 'video' ? g.video_selected_count : g.thumbnail_selected_count
  if (status === 'ready') return 'Already marked ready'
  if (status === 'processing') return 'Currently processing'
  if (status === 'completed') return 'Already completed'
  if (!g.selection_touched_at) return 'Open the gallery and select images first'
  if (selected === 0) return `Select at least one image for ${target}`
  return undefined
}

export const GenerationCard = ({ generation: g, busyTarget, onOpenGallery, onMarkReady }: Props) => {
  const [open, setOpen] = useState(false)
  const d = g.detail

  const chips = [
    d?.year && { label: 'Year', value: d.year },
    d?.category && { label: 'Category', value: d.category },
    d?.displacementCc && { label: 'Engine', value: d.displacementCc },
    d?.powerHp && { label: 'Power', value: d.powerHp },
    d?.topSpeed && { label: 'Top speed', value: d.topSpeed },
  ].filter(Boolean) as { label: string; value: string }[]

  const renderReadyButton = (target: AssetTarget) => {
    const enabled = target === 'video' ? g.can_mark_video_ready : g.can_mark_thumbnail_ready
    const status = target === 'video' ? g.video_status : g.thumbnail_status
    const busy = busyTarget === target
    const Icon = target === 'video' ? VideoCameraIcon : PhotoIcon
    const done = status !== 'not_ready' && status !== 'failed'
    return (
      <button
        onClick={() => onMarkReady(target)}
        disabled={!enabled || busy}
        title={enabled ? `Mark ready for ${target}` : disabledReason(g, target)}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all',
          enabled && !busy && (target === 'video'
            ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
            : 'bg-amber-500 text-white hover:bg-amber-600 shadow-sm'),
          done && 'bg-green-50 text-green-700 ring-1 ring-inset ring-green-200',
          !enabled && !done && 'bg-gray-100 text-gray-400 cursor-not-allowed',
          busy && 'opacity-70'
        )}
      >
        {busy ? <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" /> : done ? <CheckIcon className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
        {readyLabel(target, status)}
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white hover:shadow-md transition-shadow">
      <div className="p-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Info */}
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold text-gray-900 truncate">{g.title}</h4>
            <StatusBadge status={g.status} />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <AssetBadge target="video" status={g.video_status} />
            <AssetBadge target="thumbnail" status={g.thumbnail_status} />
            <span className="text-[11px] text-gray-400 ml-1">
              {g.images_count} images · {g.video_selected_count} for video · {g.thumbnail_selected_count} for thumbnail
            </span>
          </div>

          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {chips.map((c) => (
                <span key={c.label} className="px-2 py-0.5 rounded-md bg-gray-100 text-[11px] text-gray-600">
                  <span className="text-gray-400">{c.label}:</span> <span className="font-medium">{c.value}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
          <button
            onClick={onOpenGallery}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary-hover shadow-sm transition-colors"
          >
            <PhotoIcon className="w-4 h-4" /> View Images
          </button>
          {renderReadyButton('video')}
          {renderReadyButton('thumbnail')}
          <button
            onClick={() => setOpen((o) => !o)}
            className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Specs <ChevronDownIcon className={cn('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-gray-100 p-4 bg-white rounded-b-xl">
          <GenerationSpecs detail={g.detail} />
        </div>
      )}
    </div>
  )
}
