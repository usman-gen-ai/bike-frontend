import {
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
  FilmIcon,
  PhotoIcon,
  VideoCameraIcon,
} from '@heroicons/react/24/outline'
import type { AssetStatus, AssetTarget } from '@lib/api'
import { cn } from '@lib/utils'

// ── Scrape / production status ─────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  pending: { label: 'Pending', cls: 'bg-amber-50 text-amber-700 ring-amber-200', icon: <ClockIcon className="w-3 h-3" /> },
  scraping: { label: 'Scraping', cls: 'bg-blue-50 text-blue-700 ring-blue-200', icon: <ArrowPathIcon className="w-3 h-3 animate-spin" /> },
  scraped: { label: 'Scraped', cls: 'bg-green-50 text-green-700 ring-green-200', icon: <CheckCircleIcon className="w-3 h-3" /> },
  completed: { label: 'Completed', cls: 'bg-green-50 text-green-700 ring-green-200', icon: <CheckCircleIcon className="w-3 h-3" /> },
  video_processing: { label: 'Video Processing', cls: 'bg-purple-50 text-purple-700 ring-purple-200', icon: <FilmIcon className="w-3 h-3" /> },
  completed_with_video: { label: 'With Video', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', icon: <CheckCircleIcon className="w-3 h-3" /> },
  failed: { label: 'Failed', cls: 'bg-red-50 text-red-700 ring-red-200', icon: <ExclamationCircleIcon className="w-3 h-3" /> },
}

export const StatusBadge = ({ status }: { status: string }) => {
  const s = STATUS_MAP[status] ?? { label: status, cls: 'bg-gray-50 text-gray-700 ring-gray-200', icon: null }
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-inset', s.cls)}>
      {s.icon} {s.label}
    </span>
  )
}

// ── Video / thumbnail workflow status ──────────────────────────────────────

const ASSET_STYLE: Record<AssetStatus, { label: string; cls: string }> = {
  not_ready: { label: 'Not ready', cls: 'bg-gray-50 text-gray-500 ring-gray-200' },
  ready: { label: 'Ready', cls: 'bg-blue-50 text-blue-700 ring-blue-200' },
  processing: { label: 'Processing', cls: 'bg-purple-50 text-purple-700 ring-purple-200' },
  completed: { label: 'Done', cls: 'bg-green-50 text-green-700 ring-green-200' },
  failed: { label: 'Failed', cls: 'bg-red-50 text-red-700 ring-red-200' },
}

export const assetLabel = (s: AssetStatus) => ASSET_STYLE[s].label

export const AssetBadge = ({ target, status }: { target: AssetTarget; status: AssetStatus }) => {
  const st = ASSET_STYLE[status]
  const Icon = target === 'video' ? VideoCameraIcon : PhotoIcon
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ring-1 ring-inset', st.cls)}>
      <Icon className="w-3 h-3" />
      {target === 'video' ? 'Video' : 'Thumb'}: {st.label}
      {status === 'processing' && <ArrowPathIcon className="w-3 h-3 animate-spin" />}
    </span>
  )
}
