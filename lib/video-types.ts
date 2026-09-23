export const videoPipeline = {
  id: 'free-short-pipeline',
  label: 'Free AI Short Pipeline',
  provider: 'Gemini + EdgeTTS + Pollinations',
} as const

export const videoModels = {
  'free-short': { id: 'google/gemini-1.5-flash', label: 'Free Short Generator', provider: 'Gemini + EdgeTTS + Pollinations' },
} as const

export const videoModelKeys = ['free-short'] as const
export type VideoModelKey = (typeof videoModelKeys)[number]

export const aspectRatios = ['9:16', '16:9', '1:1'] as const
export type AspectRatio = (typeof aspectRatios)[number]

export const videoDurations = [5, 10, 15, 30, 60] as const
export type VideoDuration = (typeof videoDurations)[number]

export type VideoJobStatus = 'queued' | 'starting' | 'processing' | 'succeeded' | 'failed'

export type VideoJob = {
  id: string
  jobId?: string
  replicateId?: string
  prompt: string
  duration: number
  aspectRatio: AspectRatio
  referenceImage?: string // base64 data URL
  status: VideoJobStatus
  statusMessage?: string
  videoUrl?: string
  error?: string
  createdAt: number
  elapsedMs: number
}

export const statusLabels: Record<VideoJobStatus, string> = {
  queued: 'Queued',
  starting: 'Scripting...',
  processing: 'Rendering Short...',
  succeeded: 'Completed',
  failed: 'Failed',
}

export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
