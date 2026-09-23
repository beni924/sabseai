import { experimental_generateVideo as generateVideo } from 'ai'
import { z } from 'zod'
import { aspectRatios, videoModelKeys, videoModels } from '@/lib/video-types'

export const runtime = 'nodejs'
export const maxDuration = 300

const requestSchema = z
  .object({
    prompt: z.string().trim().min(10).max(1000),
    model: z.enum(videoModelKeys),
    aspectRatio: z.enum(aspectRatios),
  })
  .strict()

async function readBoundedBody(request: Request) {
  const reader = request.body?.getReader()
  if (!reader) return ''
  const decoder = new TextDecoder()
  let bytes = 0
  let text = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > 8000) {
        await reader.cancel()
        throw new RangeError('Body too large')
      }
      text += decoder.decode(value, { stream: true })
    }
    return text + decoder.decode()
  } finally {
    reader.releaseLock()
  }
}

// Never surface raw provider errors: they can echo credentials or internal URLs.
function safeMessage(error: unknown): string {
  if (error instanceof Error && error.name === 'AbortError') return 'Generation was cancelled or timed out before the clip finished.'
  return 'The video engine could not produce a clip for this request. Try a shorter prompt or a different model.'
}

export async function POST(request: Request) {
  // Identity is enforced by this project's Vercel Authentication; these checks only block cross-site abuse.
  if (request.headers.get('sec-fetch-site') === 'cross-site') return Response.json({ error: 'Cross-site requests are not allowed.' }, { status: 403 })
  const origin = request.headers.get('origin')
  if (origin) {
    try {
      const host = new URL(origin).host
      if (host !== request.headers.get('host') && host !== new URL(request.url).host) return Response.json({ error: 'Origin does not match.' }, { status: 403 })
    } catch {
      return Response.json({ error: 'Invalid origin.' }, { status: 403 })
    }
  }
  if (!request.headers.get('content-type')?.includes('application/json')) return Response.json({ error: 'Expected JSON.' }, { status: 415 })
  if (Number(request.headers.get('content-length') || 0) > 8000) return Response.json({ error: 'Request too large.' }, { status: 413 })

  let body: unknown
  try {
    body = JSON.parse(await readBoundedBody(request))
  } catch (error) {
    return Response.json({ error: error instanceof RangeError ? 'Request too large.' : 'Invalid JSON.' }, { status: error instanceof RangeError ? 413 : 400 })
  }
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: 'Invalid request. Prompts must contain 10–1,000 characters and use a supported model and aspect ratio.' }, { status: 400 })

  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(290000)])
  try {
    const result = await generateVideo({
      model: videoModels[parsed.data.model].id,
      prompt: parsed.data.prompt,
      aspectRatio: parsed.data.aspectRatio,
      abortSignal: signal,
      poll: { intervalMs: 5000, timeoutMs: 285000 },
    })
    const file = result.video
    return new Response(new Uint8Array(file.uint8Array), {
      headers: {
        'Content-Type': file.mediaType || 'video/mp4',
        'Cache-Control': 'no-store, no-transform',
        'Content-Disposition': 'inline',
      },
    })
  } catch (error) {
    return Response.json({ error: safeMessage(error) }, { status: signal.aborted ? 504 : 502 })
  }
}
