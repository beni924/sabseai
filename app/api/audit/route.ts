import { z } from 'zod'
import { runAudit } from '@/lib/auditor/pipeline'

export const runtime = 'nodejs'
export const maxDuration = 300

const requestSchema = z.object({ prompt: z.string().trim().min(10).max(6000), engine: z.enum(['luna', 'astra']), runId: z.string().uuid() }).strict()

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
      if (bytes > 30000) { await reader.cancel(); throw new RangeError('Body too large') }
      text += decoder.decode(value, { stream: true })
    }
    return text + decoder.decode()
  } finally { reader.releaseLock() }
}

export async function POST(request: Request) {
  // Identity is enforced by this project's All Deployments Vercel Authentication, not these CSRF checks.
  const origin = request.headers.get('origin')
  if (request.headers.get('sec-fetch-site') === 'cross-site') return Response.json({ error: 'Cross-site requests are not allowed.' }, { status: 403 })
  if (origin) {
    try {
      const host = new URL(origin).host
      if (host !== request.headers.get('host') && host !== new URL(request.url).host) return Response.json({ error: 'Origin does not match.' }, { status: 403 })
    } catch { return Response.json({ error: 'Invalid origin.' }, { status: 403 }) }
  }
  if (!request.headers.get('content-type')?.includes('application/json')) return Response.json({ error: 'Expected JSON.' }, { status: 415 })
  if (Number(request.headers.get('content-length') || 0) > 30000) return Response.json({ error: 'Request too large.' }, { status: 413 })
  let body: unknown
  try { body = JSON.parse(await readBoundedBody(request)) }
  catch (error) { return Response.json({ error: error instanceof RangeError ? 'Request too large.' : 'Invalid JSON.' }, { status: error instanceof RangeError ? 413 : 400 }) }
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: 'Invalid audit request. Prompts must contain 10–6,000 characters.' }, { status: 400 })
  const abort = new AbortController()
  const signal = AbortSignal.any([request.signal, abort.signal, AbortSignal.timeout(270000)])
  const encoder = new TextEncoder()
  let closed = false
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const heartbeat = setInterval(() => { if (!closed && !request.signal.aborted) controller.enqueue(encoder.encode('\n')) }, 10000)
      try {
        await runAudit({ ...parsed.data, signal, emit(event) { if (!closed && !request.signal.aborted) controller.enqueue(encoder.encode(JSON.stringify({ runId: parsed.data.runId, event }) + '\n')) } })
      } finally {
        clearInterval(heartbeat)
        if (!closed) { closed = true; controller.close() }
        abort.abort()
      }
    },
    cancel() { closed = true; abort.abort() },
  })
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no' } })
}
