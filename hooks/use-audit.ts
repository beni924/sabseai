'use client'

import { useEffect, useRef, useState } from 'react'
import { applyAuditEvent, auditEventSchema, initialAudit, phaseIds, type Engine, type AuditState } from '@/lib/auditor/types'

function stopState(state: AuditState, status: 'cancelled' | 'failed', message: string): AuditState {
  return { ...state, status, notices: [...state.notices, message], phases: Object.fromEntries(phaseIds.map(id => [id, ['pending', 'running'].includes(state.phases[id].status) ? { ...state.phases[id], status: state.phases[id].status === 'running' ? status : 'skipped', detail: message } : state.phases[id]])) as AuditState['phases'] }
}

export function useAudit() {
  const [state, setState] = useState(initialAudit)
  const active = useRef<{ id: string; controller: AbortController } | null>(null)
  useEffect(() => () => { active.current?.controller.abort(); active.current = null }, [])

  function cancel() {
    active.current?.controller.abort()
    active.current = null
    setState(previous => stopState(previous, 'cancelled', 'Cancelled. Completed outputs are retained.'))
  }

  async function run(prompt: string, engine: Engine) {
    if (active.current || !prompt.trim()) return
    const id = crypto.randomUUID()
    const controller = new AbortController()
    active.current = { id, controller }
    setState({ ...initialAudit(), runId: id, status: 'running' })
    const update = (fn: (previous: AuditState) => AuditState) => { if (active.current?.id === id) setState(previous => previous.runId === id ? fn(previous) : previous) }
    try {
      const response = await fetch('/api/audit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, engine, runId: id }), signal: controller.signal })
      if (!response.ok || !response.body || !response.headers.get('content-type')?.includes('application/x-ndjson')) {
        throw new Error(response.status === 400 ? 'Use a prompt between 10 and 6,000 characters.' : response.status === 413 ? 'The prompt is too large.' : response.status === 403 ? 'Audit access is restricted. Open the protected deployment with your Vercel account.' : 'The audit could not start. Check your access and try again.')
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let done = false
      try {
        while (true) {
          const chunk = await reader.read()
          buffer += decoder.decode(chunk.value, { stream: !chunk.done })
          if (buffer.length > 250000) throw new Error('The audit response exceeded its size limit.')
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          for (const line of lines) {
            if (!line.trim()) continue
            const envelope = JSON.parse(line)
            if (envelope.runId !== id) continue
            const event = auditEventSchema.parse(envelope.event)
            if (event.type === 'done') done = true
            update(previous => applyAuditEvent(previous, event))
          }
          if (chunk.done) break
        }
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
      if (!done) throw new Error('The connection ended before completion. Outputs are retained; no automatic retry was made.')
    } catch (error) {
      if (!controller.signal.aborted) update(previous => stopState(previous, 'failed', error instanceof Error && !error.message.startsWith('[') ? error.message : 'An invalid audit response was received. Please retry.'))
    } finally { if (active.current?.id === id) active.current = null }
  }
  return { state, run, cancel }
}
