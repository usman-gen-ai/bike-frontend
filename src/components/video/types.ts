import type { GenerationItem, VideoOrientation, VideoQuality } from '@lib/api'

/** One ticked generation. The page keeps these in a Record<generationId, PickedGen>. */
export interface PickedGen {
  id: number
  title: string
  mainId: number
  mainName: string
  pmId: number
  pmName: string
  /** images selected for video (5s each) */
  images: number
}

export type PickedMap = Record<number, PickedGen>

export const MAX_GENERATIONS = 300

export const isEligible = (g: GenerationItem): boolean =>
  !!g.detail && g.video_selected_count > 0 && ['ready', 'completed', 'failed'].includes(g.video_status)

const SLIDE = 5
const PUSH = 2

/** ≈ video length: 5s per selected image + 2s push between generations (mirrors the renderer). */
export const estimateSeconds = (gens: { images: number }[]): number =>
  gens.reduce((sum, g, i) => sum + g.images * SLIDE + (i > 0 ? PUSH : 0), 0)

export const QUALITIES: { value: VideoQuality; label: string; land: string; port: string; heavy?: boolean }[] = [
  { value: '480p', label: '480p', land: '854×480', port: '480×854' },
  { value: '720p', label: '720p', land: '1280×720', port: '720×1280' },
  { value: '1080p', label: '1080p', land: '1920×1080', port: '1080×1920' },
  { value: '2k', label: '2K', land: '2560×1440', port: '1440×2560' },
  { value: '4k', label: '4K', land: '3840×2160', port: '2160×3840', heavy: true },
  { value: '8k', label: '8K', land: '7680×4320', port: '4320×7680', heavy: true },
]

export const DEFAULT_QUALITY: VideoQuality = '720p'
export const DEFAULT_ORIENTATION: VideoOrientation = 'landscape'

export const formatDuration = (sec: number | null | undefined): string => {
  if (sec == null) return '—'
  const s = Math.round(sec)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
