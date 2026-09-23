'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { AspectRatio, VideoDuration, VideoJob } from '@/lib/video-types'

const STORAGE_KEY = 'luna_video_studio_jobs'

export function useVideoStudio() {
  const [jobs, setJobs] = useState<VideoJob[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as VideoJob[]
        if (Array.isArray(parsed)) {
          const restored = parsed.map(job => {
            if (job.status === 'starting' || job.status === 'processing' || job.status === 'queued') {
              return {
                ...job,
                status: 'failed' as const,
                error: 'Session interrupted before render completed. Click Retry to render again.',
              }
            }
            return job
          })
          setJobs(restored)
        }
      }
    } catch {
      // localStorage unavailable
    }
    setIsLoaded(true)
  }, [])

  // Persist to localStorage
  useEffect(() => {
    if (!isLoaded) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs))
    } catch {
      // localStorage write error
    }
  }, [jobs, isLoaded])

  const patchJob = useCallback((id: string, update: Partial<VideoJob>) => {
    setJobs(prev => prev.map(job => (job.id === id ? { ...job, ...update } : job)))
  }, [])

  // Poll status for active jobs
  const activeJobs = jobs.filter(j => j.status === 'starting' || j.status === 'processing')
  const activeJobsRef = useRef(activeJobs)
  activeJobsRef.current = activeJobs

  useEffect(() => {
    if (activeJobs.length === 0) return

    const interval = setInterval(() => {
      activeJobsRef.current.forEach(async job => {
        const targetId = job.jobId || job.replicateId
        if (!targetId) return

        const newElapsed = Date.now() - job.createdAt
        patchJob(job.id, { elapsedMs: newElapsed })

        try {
          const res = await fetch(`/api/video/status?id=${encodeURIComponent(targetId)}`)
          const data = await res.json()

          if (!res.ok) {
            patchJob(job.id, {
              status: 'failed',
              error: data.error || 'Failed to check video status.',
            })
            return
          }

          if (data.status === 'succeeded') {
            patchJob(job.id, {
              status: 'succeeded',
              videoUrl: data.videoUrl,
              statusMessage: 'Completed',
              elapsedMs: Date.now() - job.createdAt,
            })
          } else if (data.status === 'failed') {
            patchJob(job.id, {
              status: 'failed',
              error: data.error || 'Video generation failed during rendering.',
            })
          } else {
            patchJob(job.id, {
              status: data.status,
              statusMessage: data.progress || 'Rendering Short...',
            })
          }
        } catch {
          // Retry on next interval
        }
      })
    }, 3000)

    return () => clearInterval(interval)
  }, [activeJobs, patchJob])

  const startGeneration = useCallback(
    async (params: { prompt: string; duration: VideoDuration; aspectRatio: AspectRatio; referenceImage?: string }) => {
      const localId = crypto.randomUUID()
      const now = Date.now()

      const newJob: VideoJob = {
        id: localId,
        prompt: params.prompt.trim(),
        duration: params.duration,
        aspectRatio: params.aspectRatio,
        referenceImage: params.referenceImage,
        status: 'starting',
        statusMessage: 'Generating script with Gemini AI...',
        createdAt: now,
        elapsedMs: 0,
      }

      setJobs(prev => [newJob, ...prev])

      try {
        const res = await fetch('/api/video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: params.prompt,
            duration: params.duration,
            aspectRatio: params.aspectRatio,
            referenceImage: params.referenceImage,
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          patchJob(localId, {
            status: 'failed',
            error: data.error || 'Failed to start video generation.',
          })
          return
        }

        patchJob(localId, {
          jobId: data.jobId,
          status: 'processing',
          statusMessage: data.progress || 'Rendering Short...',
        })
      } catch (err) {
        patchJob(localId, {
          status: 'failed',
          error: err instanceof Error ? err.message : 'Network error while initiating video generation.',
        })
      }
    },
    [patchJob]
  )

  const deleteJob = useCallback((id: string) => {
    setJobs(prev => prev.filter(j => j.id !== id))
  }, [])

  const retryJob = useCallback(
    (id: string) => {
      const existing = jobs.find(j => j.id === id)
      if (!existing) return
      deleteJob(id)
      void startGeneration({
        prompt: existing.prompt,
        duration: existing.duration as VideoDuration,
        aspectRatio: existing.aspectRatio,
        referenceImage: existing.referenceImage,
      })
    },
    [jobs, deleteJob, startGeneration]
  )

  const clearAllJobs = useCallback(() => {
    setJobs([])
  }, [])

  const isGeneratingAny = jobs.some(j => j.status === 'starting' || j.status === 'processing')

  return {
    jobs,
    isGeneratingAny,
    startGeneration,
    deleteJob,
    retryJob,
    clearAllJobs,
  }
}
