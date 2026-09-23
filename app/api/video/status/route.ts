import { NextResponse } from 'next/server'
import { getVideoJob } from '@/lib/video-pipeline'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing job id parameter.' }, { status: 400 })
    }

    const job = getVideoJob(id)

    if (!job) {
      return NextResponse.json({ error: 'Video generation job not found or expired.' }, { status: 404 })
    }

    if (job.status === 'succeeded') {
      return NextResponse.json({
        status: 'succeeded',
        videoUrl: job.videoUrl,
        progress: job.progressMessage,
      })
    }

    if (job.status === 'failed') {
      return NextResponse.json({
        status: 'failed',
        error: job.error || 'Video generation failed during processing.',
        progress: job.progressMessage,
      })
    }

    return NextResponse.json({
      status: job.status,
      progress: job.progressMessage,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An error occurred while checking video status.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
