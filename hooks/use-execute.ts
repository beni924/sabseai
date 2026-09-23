'use client'

import { useEffect, useRef, useState } from 'react'
import { applyExecutionEvent, executionEventSchema, initialExecution, type ExecutionState } from '@/lib/auditor/types'

export function useExecute() {
  const [state, setState] = useState(initialExecution)
  const active = useRef<{ id: string; controller: AbortController } | null>(null)
  useEffect(() => () => { active.current?.controller.abort(); active.current = null }, [])

  function cancel() {
    active.current?.controller.abort()
    active.current = null
    setState(previous => previous.status === 'running' ? { ...previous, status: 'error', message: 'Execution cancelled. Completed attempts are retained.' } : previous)
  }

  async function run(code: string) {
    if (active.current || !code.trim()) return
    const id = crypto.randomUUID()
    const controller = new AbortController()
    active.current = { id, controller }
    setState({ ...initialExecution(), runId: id, status: 'running', message: 'Preparing the sandbox…' })
    const update = (fn: (previous: ExecutionState) => ExecutionState) => { if (active.current?.id === id) setState(previous => previous.runId === id ? fn(previous) : previous) }
    try {
      const response = await fetch('/api/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, runId: id }), signal: controller.signal })
      if (!response.ok || !response.body || !response.headers.get('content-type')?.includes('application/x-ndjson')) {
        throw new Error(response.status === 400 ? 'The script must be between 1 and 20,000 characters.' : response.status === 413 ? 'The script is too large to run.' : response.status === 403 ? 'Execution access is restricted. Open the protected deployment with your Vercel account.' : 'The sandbox could not start. Check your access and try again.')
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let done = false
      try {
        while (true) {
          const chunk = await reader.read()
          buffer += decoder.decode(chunk.value, { stream: !chunk.done })
          if (buffer.length > 250000) throw new Error('The execution response exceeded its size limit.')
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''
          for (const line of lines) {
            if (!line.trim()) continue
            const envelope = JSON.parse(line)
            if (envelope.runId !== id) continue
            const event = executionEventSchema.parse(envelope.event)
            if (event.type === 'done') done = true
            update(previous => applyExecutionEvent(previous, event))
          }
          if (chunk.done) break
        }
      } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
      if (!done) throw new Error('The connection ended before execution finished. Completed attempts are retained.')
    } catch (error) {
      if (!controller.signal.aborted) update(previous => ({ ...previous, status: 'error', message: error instanceof Error ? error.message : 'An invalid execution response was received.' }))
    } finally { if (active.current?.id === id) active.current = null }
  }
  return { state, run, cancel }
}
