import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createVideoJob } from '@/lib/video-pipeline'

export const maxDuration = 300
const videoRequestSchema = z.object({
  prompt: z
    .string()
    .min(3, 'Prompt must be at least 3 characters.')
    .max(2000, 'Prompt must be under 2000 characters.'),
  duration: z.number().default(15),
  aspectRatio: z.enum(['9:16', '16:9', '1:1']).default('9:16'),
  referenceImage: z.string().optional(),
})

export async function POST(request: Request) {
  try {
    const e2bKey = process.env.E2B_API_KEY
    if (!e2bKey) {
      return NextResponse.json(
        {
          error:
            'E2B_API_KEY is not configured in environment variables. Please add E2B_API_KEY in project settings.',
        },
        { status: 400 }
      )
    }

    const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
    if (!googleKey) {
      return NextResponse.json(
        {
          error:
            'GOOGLE_GENERATIVE_AI_API_KEY is not configured in environment variables. Please verify your Gemini API key.',
        },
        { status: 400 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const parsed = videoRequestSchema.safeParse(body)

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Invalid input parameters.'
      return NextResponse.json({ error: firstError }, { status: 400 })
    }

    const { prompt, duration, aspectRatio } = parsed.data

    const job = createVideoJob(prompt, duration, aspectRatio)

    return NextResponse.json({
      jobId: job.id,
      status: job.status,
      progress: job.progressMessage,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
