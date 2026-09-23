'use client'

import { useEffect, useRef, useState } from 'react'
import type { ChatEvent, ContextFile, ModelChoice, Turn } from '@/lib/chat-types'

type RequestData = { messages: { role: 'user' | 'assistant'; content: string }[]; model: ModelChoice; web: boolean }

export function useLunaChat() {
  const [turns, setTurns] = useState<Turn[]>([])
  const [busy, setBusy] = useState(false)
  const [phase, setPhase] = useState('')
  const controller = useRef<AbortController | null>(null)
  const lastRequest = useRef<{ body: RequestData; id: string } | null>(null)
  useEffect(() => () => controller.current?.abort(), [])

  async function run(body: RequestData, id: string) {
    const current = new AbortController()
    controller.current = current
    lastRequest.current = { body, id }
    setBusy(true)
    setPhase(body.web ? 'Searching the web…' : 'Luna is thinking…')
    const update = (patch: Partial<Turn>) => { if (controller.current === current) setTurns(previous => previous.map(turn => turn.id === id ? { ...turn, ...patch } : turn)) }
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: current.signal })
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || 'Unable to send your message.') }
      if (!response.body) throw new Error('No response stream was received.')
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = '', text = '', finished = false
      while (true) {
        const chunk = await reader.read()
        buffer += decoder.decode(chunk.value, { stream: !chunk.done })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          if (!line.trim() || controller.current !== current) continue
          const event = JSON.parse(line) as ChatEvent
          if (event.type === 'text') { text += event.text; update({ text }); setPhase('Writing…') }
          if (event.type === 'status') setPhase(event.message)
          if (event.type === 'sources') update({ sources: event.sources })
          if (event.type === 'warning') update({ warning: event.message })
          if (event.type === 'error') throw new Error(event.message)
          if (event.type === 'done') finished = true
        }
        if (chunk.done) break
      }
      if (!finished) throw new Error('The connection ended before the response finished. Please retry.')
    } catch (error) {
      update(current.signal.aborted ? { warning: 'Generation stopped.' } : { error: error instanceof Error ? error.message : 'Unable to connect. Please retry.' })
      current.abort()
    } finally {
      if (controller.current === current) { controller.current = null; setBusy(false); setPhase('') }
    }
  }

  function send(text: string, files: ContextFile[], model: ModelChoice, web: boolean) {
    if (controller.current || !text.trim()) return
    const context = files.length ? '\n\n<attached-files>\n' + files.map(file => JSON.stringify(file)).join('\n') + '\n</attached-files>' : ''
    const user: Turn = { id: crypto.randomUUID(), role: 'user', text: text + (files.length ? `\n\nAttached: ${files.map(f => f.name).join(', ')}` : ''), context: text + context }
    const id = crypto.randomUUID()
    const history = [...turns.filter(turn => !turn.error && turn.text.trim()), user].slice(-39)
    setTurns(previous => [...previous, user, { id, role: 'assistant', text: '' }])
    void run({ messages: history.map(turn => ({ role: turn.role, content: turn.context || turn.text })), model, web }, id)
  }

  function retry() {
    if (controller.current || !lastRequest.current) return
    const { body, id } = lastRequest.current
    setTurns(previous => previous.map(turn => turn.id === id ? { id, role: 'assistant', text: '' } : turn))
    void run(body, id)
  }

  function reset() { controller.current?.abort(); controller.current = null; lastRequest.current = null; setTurns([]); setBusy(false); setPhase('') }
  function loadTurns(newTurns: Turn[]) { controller.current?.abort(); controller.current = null; lastRequest.current = null; setTurns(newTurns); setBusy(false); setPhase('') }
  return { turns, busy, phase, send, retry, reset, loadTurns, stop: () => controller.current?.abort() }
}
