'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { ArrowUpRight, Check, Circle, Database, Globe, KeyRound, LoaderCircle, LockKeyhole, Play, RefreshCw, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupTextarea, InputGroupAddon } from '@/components/ui/input-group'
import { engines, phaseIds, type Engine, type AuditState } from '@/lib/auditor/types'

const providers = [
  { id: 'openai', name: 'OpenAI Gateway', detail: 'Luna / Astra · draft generation' },
  { id: 'anthropic', name: 'Native Claude', detail: 'Fable 5.1 · independent critique' },
  { id: 'gemini', name: 'Google Gemini', detail: 'Gemini 3.8 Flash · logic review' },
  { id: 'tavily', name: 'Tavily', detail: 'Live documentation research' },
  { id: 'openrouter', name: 'OpenRouter', detail: 'Alternative models · optional' },
  { id: 'pinecone', name: 'Pinecone', detail: 'Private context · not enabled' },
]
export const phaseNames = { retrieval: 'Retrieve context', draft: 'Generate first draft', critique: 'Critique & revise', research: 'Research claims' }
type Connections = { connections: { id: string; status: string; detail: string }[] }
async function fetchConnections(url: string): Promise<Connections> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Connection checks unavailable')
  return response.json()
}

export function AuditController({ state, onRun, onCancel }: { state: AuditState; onRun: (prompt: string, engine: Engine) => void; onCancel: () => void }) {
  const [prompt, setPrompt] = useState('')
  const [engine, setEngine] = useState<Engine>('luna')
  const [checking, setChecking] = useState(false)
  const { data, error, isValidating, mutate } = useSWR(checking ? '/api/connections' : null, fetchConnections, { revalidateOnFocus: false, shouldRetryOnError: false, dedupingInterval: 60000 })
  const running = state.status === 'running'
  return <aside className="flex min-w-0 flex-col border-b border-border xl:border-r xl:border-b-0" aria-label="Audit controller">
    <form onSubmit={event => { event.preventDefault(); if (!running && prompt.trim().length >= 10) onRun(prompt, engine) }} className="flex flex-col gap-5 p-6">
      <div className="flex items-center justify-between"><h2 className="text-sm font-medium">The starting point</h2><span className="text-sm text-muted-foreground">01 — 04</span></div>
      <FieldGroup><Field><FieldLabel htmlFor="audit-prompt">What are you building?</FieldLabel><InputGroup>
        <InputGroupTextarea id="audit-prompt" placeholder="Describe a coding challenge, paste a function, or ask a question worth checking…" className="min-h-36" value={prompt} maxLength={6000} minLength={10} required disabled={running} onChange={event => setPrompt(event.target.value)} />
        <InputGroupAddon align="block-end"><span className="ml-auto text-sm font-normal">{prompt.length.toLocaleString()} / 6,000</span></InputGroupAddon>
      </InputGroup></Field><Field><FieldLabel htmlFor="audit-engine">Generation engine</FieldLabel><select id="audit-engine" className="h-10 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-ring" value={engine} disabled={running} onChange={event => setEngine(event.target.value as Engine)}>{Object.entries(engines).map(([id, value]) => <option key={id} value={id}>{value.label} · {value.model.replace('openai/', '')}</option>)}</select></Field></FieldGroup>
      {running ? <Button type="button" variant="outline" onClick={onCancel}><Square data-icon="inline-start" />Cancel audit</Button> : <Button type="submit" disabled={prompt.trim().length < 10}><Play data-icon="inline-start" />Run Audit<ArrowUpRight data-icon="inline-end" /></Button>}
      <p className="text-sm leading-relaxed text-muted-foreground">A live run uses provider credits. Nothing runs until you ask.</p>
    </form>
    <section className="flex flex-col gap-4 border-y border-border p-6"><div className="flex items-center justify-between"><h2 className="text-sm font-medium">Pipeline</h2><Badge variant="outline">{state.status === 'idle' ? 'Ready' : state.status}</Badge></div>
      <ol className="flex flex-col gap-5">{phaseIds.map((id, index) => { const phase = state.phases[id]; return <li key={id} className="flex items-start gap-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-secondary text-primary">{phase.status === 'running' ? <LoaderCircle className="size-4 animate-spin" /> : phase.status === 'completed' ? <Check className="size-4" /> : <span className="text-sm">{index + 1}</span>}</span><div className="flex min-w-0 flex-col gap-1"><span className="text-sm font-medium">{phaseNames[id]}</span><span className="text-sm leading-relaxed text-muted-foreground">{phase.status === 'pending' ? 'Waiting to start' : phase.detail}</span>{phase.durationMs !== undefined && <span className="text-sm text-muted-foreground">{(phase.durationMs / 1000).toFixed(1)}s · {phase.status}</span>}</div></li> })}</ol>
    </section>
    <section className="flex flex-col gap-4 p-6"><div className="flex items-center justify-between"><h2 className="text-sm font-medium">API integrations hub</h2><KeyRound className="size-4 text-muted-foreground" /></div>
      <div className="flex flex-col gap-2">{providers.map(provider => { const connection = data?.connections.find(item => item.id === provider.id);
        const observed = provider.id === 'openai' ? state.phases.draft.status === 'completed' ? 'Draft received' : state.phases.draft.status === 'failed' ? 'Draft failed' : 'Gateway · not run'
          : provider.id === 'anthropic' && state.reviews.claude ? `Review ${state.reviews.claude.status}`
          : provider.id === 'gemini' && state.reviews.gemini ? `Review ${state.reviews.gemini.status}`
          : provider.id === 'tavily' && state.phases.research.status === 'completed' ? `${state.sources.length} sources received` : null;
        return <div key={provider.id} className="flex items-start gap-3 rounded-lg border border-border p-3" title={connection?.detail}>
        {provider.id === 'pinecone' ? <Database className="mt-1 size-4 shrink-0 text-muted-foreground" /> : provider.id === 'tavily' ? <Globe className="mt-1 size-4 shrink-0 text-primary" /> : <Circle className="mt-1 size-4 shrink-0 text-muted-foreground" />}
        <div className="flex min-w-0 flex-col gap-1"><span className="text-sm font-medium">{provider.name}</span><span className="text-sm leading-relaxed text-muted-foreground">{provider.detail}</span><span className="text-sm text-primary">{observed || (connection?.status === 'Verified' ? 'Credential check passed' : connection?.status) || (provider.id === 'openrouter' ? 'Unavailable' : provider.id === 'pinecone' ? 'Setup required' : 'Not checked')}</span></div>
      </div> })}</div>
      <Button variant="outline" size="sm" disabled={isValidating} onClick={() => { if (!checking) setChecking(true); else void mutate() }}><RefreshCw data-icon="inline-start" />{isValidating ? 'Checking…' : 'Check connections'}</Button>
      {error && <p role="alert" className="text-sm">Connection checks could not load. Try again.</p>}
      <p className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground"><LockKeyhole className="mt-1 size-4 shrink-0" />Credentials stay on the server. No keys in browser storage.</p>
    </section>
  </aside>
}
