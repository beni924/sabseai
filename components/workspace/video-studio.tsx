'use client'

import { useState, useRef, ChangeEvent, DragEvent } from 'react'
import {
  Clapperboard,
  Sparkles,
  Loader2,
  AlertCircle,
  Download,
  Trash2,
  RotateCcw,
  Upload,
  X,
  Clock,
  Film,
  Image as ImageIcon,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { useVideoStudio } from '@/hooks/use-video-studio'
import {
  aspectRatios,
  videoDurations,
  formatElapsed,
  formatDate,
  type AspectRatio,
  type VideoDuration,
  type VideoJob,
} from '@/lib/video-types'
import { cn } from '@/lib/utils'

function VideoCard({
  job,
  onDelete,
  onRetry,
}: {
  job: VideoJob
  onDelete: (id: string) => void
  onRetry: (id: string) => void
}) {
  const isGenerating = job.status === 'starting' || job.status === 'processing'
  const isFailed = job.status === 'failed'
  const isSucceeded = job.status === 'succeeded'

  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs transition-all',
        isGenerating && 'border-primary/40 bg-primary/[0.02]',
        isFailed && 'border-destructive/40 bg-destructive/[0.02]',
        isSucceeded && 'border-border hover:border-border/80'
      )}
    >
      {/* Media / Video Display Area */}
      <div className="relative aspect-video w-full overflow-hidden bg-black/90 flex items-center justify-center">
        {isSucceeded && job.videoUrl ? (
          <video
            src={job.videoUrl}
            controls
            loop
            playsInline
            className="h-full w-full object-contain"
            aria-label={`Generated video: ${job.prompt}`}
          />
        ) : isGenerating ? (
          <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="relative flex items-center justify-center">
              <Loader2 className="size-8 animate-spin text-primary" />
              <Film className="absolute size-4 text-primary/70" />
            </div>
            <div className="flex flex-col items-center gap-1">
              <p className="text-sm font-medium text-foreground">{job.statusMessage || 'Rendering video...'}</p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="size-3" />
                Elapsed: {formatElapsed(job.elapsedMs)}
              </p>
            </div>
            <div className="w-48 overflow-hidden rounded-full bg-secondary h-1.5 mt-1">
              <div className="bar-indeterminate h-full bg-primary rounded-full" />
            </div>
          </div>
        ) : isFailed ? (
          <div className="flex flex-col items-center justify-center gap-2 p-6 text-center text-destructive">
            <AlertCircle className="size-8 text-destructive/80" />
            <p className="text-sm font-medium">Generation Failed</p>
          </div>
        ) : null}

        {/* Top Badges */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2 pointer-events-none">
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className="bg-black/70 text-white backdrop-blur-md border-none text-[11px] font-mono">
              {job.aspectRatio}
            </Badge>
            <Badge variant="secondary" className="bg-black/70 text-white backdrop-blur-md border-none text-[11px]">
              {job.duration}s
            </Badge>
            <Badge variant="secondary" className="bg-emerald-600/80 text-white backdrop-blur-md border-none text-[10px]">
              FREE
            </Badge>
          </div>

          <div className="pointer-events-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-7 bg-black/60 text-white hover:bg-black/80 hover:text-white rounded-md backdrop-blur-md"
              onClick={() => onDelete(job.id)}
              aria-label="Delete video card"
              title="Delete video"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Details & Action Area */}
      <div className="flex flex-col gap-3 p-4 flex-1 justify-between">
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-muted-foreground/80">{formatDate(job.createdAt)}</p>
          <p className="text-sm leading-relaxed text-foreground line-clamp-3 font-normal">{job.prompt}</p>

          {job.referenceImage && (
            <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
              <ImageIcon className="size-3 text-primary" />
              <span>Reference image attached</span>
            </div>
          )}
        </div>

        {/* Inline Error Details & Retry */}
        {isFailed && (
          <div className="mt-2 flex flex-col gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            <div className="flex items-start gap-2">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <p className="flex-1 leading-normal font-medium">{job.error || 'Video generation failed.'}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5 border-destructive/40 bg-background text-destructive hover:bg-destructive/10 hover:text-destructive text-xs"
              onClick={() => onRetry(job.id)}
            >
              <RotateCcw className="size-3.5" />
              Retry Generation
            </Button>
          </div>
        )}

        {/* Success Download Button */}
        {isSucceeded && job.videoUrl && (
          <div className="pt-1 flex items-center justify-between gap-2 border-t border-border/50">
            <span className="text-xs text-muted-foreground">
              Rendered in {formatElapsed(job.elapsedMs)}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-8"
              onClick={() => {
                const a = document.createElement('a')
                a.href = job.videoUrl || '#'
                a.download = `short-${job.id.slice(0, 8)}.mp4`
                a.target = '_blank'
                a.click()
              }}
            >
              <Download className="size-3.5" />
              Download MP4
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export function VideoStudio() {
  const { jobs, isGeneratingAny, startGeneration, deleteJob, retryJob, clearAllJobs } = useVideoStudio()

  const [prompt, setPrompt] = useState('')
  const [duration, setDuration] = useState<VideoDuration>(15)
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16')
  const [referenceImage, setReferenceImage] = useState<string | undefined>(undefined)
  const [isDragging, setIsDragging] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const isPromptValid = prompt.trim().length >= 3

  function handleImageFile(file: File) {
    if (!file.type.startsWith('image/')) return
    if (file.size > 10 * 1024 * 1024) {
      alert('Image file must be under 10MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = e => {
      if (typeof e.target?.result === 'string') {
        setReferenceImage(e.target.result)
      }
    }
    reader.readAsDataURL(file)
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleImageFile(file)
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleImageFile(file)
  }

  function handleSubmit() {
    if (!isPromptValid || isGeneratingAny) return
    void startGeneration({
      prompt,
      duration,
      aspectRatio,
      referenceImage,
    })
    setPrompt('')
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 py-6 md:px-7 lg:flex-row lg:gap-8 lg:overflow-hidden">
      {/* Left Control Panel */}
      <div className="flex w-full flex-col gap-5 lg:w-[380px] lg:shrink-0 lg:overflow-y-auto lg:pr-1">
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Clapperboard className="size-5 text-primary" />
              <h2 className="font-semibold text-base">Free Short Studio</h2>
            </div>
            <Badge variant="outline" className="text-[10px] gap-1 bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
              <Zap className="size-3" />
              100% Free
            </Badge>
          </div>

          {/* Prompt Textarea */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="video-prompt" className="text-xs font-medium">
                Topic / Prompt
              </Label>
              <span className="text-[11px] text-muted-foreground">{prompt.length}/2000</span>
            </div>
            <Textarea
              id="video-prompt"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Describe your video short topic... e.g., 5 mind-blowing facts about deep sea creatures you didn't know."
              className="min-h-[110px] resize-none text-sm leading-relaxed"
              maxLength={2000}
            />
          </div>

          {/* Duration Selector */}
          <div className="flex flex-col gap-2">
            <Label className="text-xs font-medium">Target Duration</Label>
            <div className="grid grid-cols-3 gap-2">
              {videoDurations.map(d => (
                <Button
                  key={d}
                  type="button"
                  variant={duration === d ? 'default' : 'outline'}
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() => setDuration(d)}
                >
                  <Clock className="size-3.5" />
                  {d}s
                </Button>
              ))}
            </div>
          </div>

          {/* Aspect Ratio Selector */}
          <div className="flex flex-col gap-2">
            <Label className="text-xs font-medium">Aspect Ratio</Label>
            <div className="grid grid-cols-3 gap-2">
              {aspectRatios.map(r => (
                <Button
                  key={r}
                  type="button"
                  variant={aspectRatio === r ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs font-mono"
                  onClick={() => setAspectRatio(r)}
                >
                  {r}
                </Button>
              ))}
            </div>
          </div>

          {/* Optional Reference Image Upload */}
          <div className="flex flex-col gap-2">
            <Label className="text-xs font-medium flex items-center justify-between">
              <span>Reference Image (Optional)</span>
            </Label>

            {referenceImage ? (
              <div className="relative flex items-center gap-3 rounded-lg border border-border bg-secondary/50 p-2">
                <img
                  src={referenceImage}
                  alt="Reference preview"
                  className="size-12 rounded object-cover border border-border"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">Reference image attached</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-foreground"
                  onClick={() => setReferenceImage(undefined)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border p-4 text-center transition-colors hover:border-primary/50 hover:bg-secondary/30',
                  isDragging && 'border-primary bg-primary/5'
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Upload className="size-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground font-medium">
                  Click or drag image here
                </p>
                <p className="text-[11px] text-muted-foreground/70">PNG, JPG or WebP up to 10MB</p>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <Button
            size="lg"
            className="w-full gap-2 font-medium mt-1"
            disabled={!isPromptValid || isGeneratingAny}
            onClick={handleSubmit}
          >
            {isGeneratingAny ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Rendering Short...
              </>
            ) : (
              <>
                <Sparkles className="size-4 text-amber-300 fill-amber-300" />
                Generate Free Short
              </>
            )}
          </Button>

          <div className="flex flex-col gap-1 rounded-lg bg-secondary/40 p-3 text-[11px] text-muted-foreground">
            <p className="font-semibold text-foreground">Zero Paid APIs Required</p>
            <p>1. Gemini AI writes scene script & captions</p>
            <p>2. Edge-TTS synthesizes neural voiceover</p>
            <p>3. Pollinations.ai generates AI scene visuals</p>
            <p>4. FFmpeg in E2B sandbox builds 9:16 vertical MP4</p>
          </div>
        </div>
      </div>

      {/* Right Panel: Videos Display Grid */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Film className="size-4 text-primary" />
            <h3 className="font-medium text-sm">Generated Shorts</h3>
            <Badge variant="secondary" className="text-xs font-mono">
              {jobs.length}
            </Badge>
          </div>

          {jobs.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-destructive"
              onClick={clearAllJobs}
            >
              Clear Gallery
            </Button>
          )}
        </div>

        {jobs.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-16">
            <Empty className="max-w-md">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Film className="size-8 text-primary" />
                </EmptyMedia>
                <EmptyTitle className="text-lg">No video shorts created yet</EmptyTitle>
                <EmptyDescription className="text-sm leading-relaxed">
                  Enter a topic on the left and click{' '}
                  <strong className="text-foreground">Generate Free Short</strong> to assemble a vertical 9:16 video with narration, visuals & burned-in captions.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-2">
            {jobs.map(job => (
              <VideoCard key={job.id} job={job} onDelete={deleteJob} onRetry={retryJob} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
