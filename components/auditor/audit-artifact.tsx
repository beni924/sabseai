'use client'

import { useState } from 'react'
import { Check, Copy, Download, ExternalLink, FileCode2, Play, Square, Terminal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import { cn } from '@/lib/utils'
import { extractPython } from '@/lib/auditor/extract'
import { useExecute } from '@/hooks/use-execute'
import type { AuditState } from '@/lib/auditor/types'

const executionLabels = { idle: 'Ready to run', running: 'Running…', 'ran-clean': 'Ran, no error', 'still-failing': 'Still failing', error: 'Error' } as const

export function AuditArtifact({ state }: { state: AuditState }) {
  const [message, setMessage] = useState('')
  const artifact = state.revision || state.draft
  const artifactLabel = state.revision ? 'Suggested revision' : 'Initial draft'
  const pythonCode = extractPython(artifact)
  const { state: execution, run: runExecution, cancel: cancelExecution } = useExecute()
  const repaired = execution.status === 'ran-clean' && execution.attempts.length > 1 ? execution.attempts[execution.attempts.length - 1].code : null
  async function copy() {
    try { await navigator.clipboard.writeText(artifact); setMessage('Copied to clipboard.') }
    catch { setMessage('Clipboard unavailable. Use Download instead.') }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([artifact], { type: 'text/plain;charset=utf-8' }))
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = state.revision ? 'luna-suggested-revision.txt' : 'luna-initial-draft.txt'; anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setMessage(`${artifactLabel} downloaded.`)
  }
  return <aside className="flex min-w-0 flex-col border-t border-border bg-secondary/35 xl:border-t-0 xl:border-l" aria-label="Suggested artifact and evidence">
    <header className="flex items-center justify-between border-b border-border p-5"><span className="flex items-center gap-2 text-sm font-medium"><FileCode2 className="size-4 text-primary" />Artifacts</span><Badge variant="outline">{execution.status === 'ran-clean' ? 'Ran, not verified' : 'Not verified'}</Badge></header>
    <dl className="grid grid-cols-2 gap-4 border-b border-border p-5"><div className="flex flex-col gap-2"><dt className="text-sm text-muted-foreground">Execution</dt><dd className="text-sm font-medium">{execution.status === 'idle' ? (pythonCode ? 'Ready to run' : 'Not run') : executionLabels[execution.status]}</dd></div><div className="flex flex-col gap-2"><dt className="text-sm text-muted-foreground">Test coverage</dt><dd className="text-sm font-medium">Not measured</dd></div><div className="flex flex-col gap-2"><dt className="text-sm text-muted-foreground">Audit status</dt><dd className="text-sm font-medium capitalize">{state.status === 'idle' ? 'Awaiting prompt' : state.status}</dd></div><div className="flex flex-col gap-2"><dt className="text-sm text-muted-foreground">Run duration</dt><dd className="text-sm font-medium">{state.durationMs ? `${(state.durationMs / 1000).toFixed(1)}s` : '—'}</dd></div></dl>
    <Tabs defaultValue="revision" className="flex-1"><div className="px-5 pt-4"><TabsList aria-label="Artifact views"><TabsTrigger value="revision">{artifact ? artifactLabel : 'Suggested revision'}</TabsTrigger><TabsTrigger value="sources">Evidence ({state.sources.length})</TabsTrigger></TabsList></div>
      <TabsContent value="revision" className="p-5">{artifact ? <div className="flex flex-col gap-4"><p className="text-sm leading-relaxed text-muted-foreground">{state.revision ? 'Suggested changes only. Validate with real tests before use.' : 'Original draft only. No suggested revision is available yet.'}</p><pre className="max-h-80 overflow-y-auto whitespace-pre-wrap break-words font-mono text-sm leading-relaxed">{artifact}</pre></div> : <Empty className="min-h-64"><EmptyHeader><EmptyMedia variant="icon"><FileCode2 /></EmptyMedia><EmptyTitle>A considered revision</EmptyTitle><EmptyDescription>After the reviews, a suggested corrected artifact appears here. It still needs your judgment and real tests.</EmptyDescription></EmptyHeader></Empty>}</TabsContent>
      <TabsContent value="sources" className="p-5"><div className="flex flex-col gap-5"><p className="text-sm leading-relaxed text-muted-foreground">{state.phases.research.detail}. Web evidence does not prove executable correctness.</p>{state.sources.map((source, index) => <article key={source.url} className="flex flex-col gap-2 border-t border-border pt-4"><a className="flex items-start gap-2 text-sm font-medium underline underline-offset-4" href={source.url} target="_blank" rel="noopener noreferrer">[{index + 1}] {source.title}<ExternalLink className="mt-1 size-4 shrink-0" /></a><p className="text-sm leading-relaxed text-muted-foreground">{source.content.slice(0, 450)}</p></article>)}{state.assessment?.claims.map((claim, index) => <article key={index} className="flex flex-col gap-2 rounded-lg border border-border p-3"><Badge variant="outline">{claim.assessment}</Badge><h3 className="text-sm font-medium">{claim.claim}</h3><p className="text-sm leading-relaxed text-muted-foreground">{claim.explanation}</p><span className="text-sm text-muted-foreground">{claim.sourceIds.length ? `Sources: ${claim.sourceIds.map(id => `[${id}]`).join(', ')}` : 'No supporting source'}</span></article>)}</div></TabsContent>
    </Tabs>
    <div className="flex flex-col gap-2 border-t border-border p-5"><div className="flex gap-2"><Button variant="outline" size="sm" disabled={!artifact} onClick={() => void copy()}>{message.startsWith('Copied') ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}Copy</Button><Button variant="outline" size="sm" disabled={!artifact} onClick={download}><Download data-icon="inline-start" />Download</Button></div>{message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}</div>
    <section className="audit-console flex flex-col gap-4 p-5" aria-label="Sandbox execution">
      <div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-sm font-medium"><Terminal className="size-4" />Run &amp; repair</h2>{execution.status === 'running' ? <Button variant="outline" size="sm" onClick={cancelExecution}><Square data-icon="inline-start" />Stop</Button> : <Button variant="outline" size="sm" disabled={!pythonCode} onClick={() => { if (pythonCode) void runExecution(pythonCode) }}><Play data-icon="inline-start" />Run &amp; repair</Button>}</div>
      {!pythonCode
        ? <p className="text-sm leading-relaxed opacity-75">Runs a single Python script in an isolated E2B sandbox and asks Claude to repair runtime errors, up to 3 attempts. Available once the artifact contains a Python code block.</p>
        : <div className="flex flex-col gap-3">
            <p className="text-sm leading-relaxed opacity-75">Executes in an isolated sandbox. A clean run means no runtime error was raised — not that the code is correct or tested.</p>
            {execution.attempts.map(attempt => <div key={attempt.attempt} className="flex flex-col gap-1 font-mono text-sm leading-relaxed">
              <p className="opacity-50">$ python script.py  · attempt {attempt.attempt}</p>
              {attempt.stdout && <pre className="whitespace-pre-wrap break-words">{attempt.stdout}</pre>}
              {attempt.stderr && <pre className="whitespace-pre-wrap break-words text-destructive">{attempt.stderr}</pre>}
              <p className={attempt.ranWithoutError ? 'text-primary' : 'text-destructive'}>{attempt.ranWithoutError ? 'Exited without a runtime error.' : `${attempt.errorName || 'Error'}${attempt.errorValue ? `: ${attempt.errorValue}` : ''}`}</p>
            </div>)}
            {execution.message && <p role="status" aria-live="polite" className={cn('text-sm leading-relaxed', execution.status === 'ran-clean' && 'text-primary', (execution.status === 'still-failing' || execution.status === 'error') && 'text-destructive', (execution.status === 'idle' || execution.status === 'running') && 'opacity-75')}>{execution.message}</p>}
            {repaired && <Button variant="outline" size="sm" className="self-start" onClick={() => { void navigator.clipboard.writeText(repaired).then(() => setMessage('Repaired script copied.')).catch(() => setMessage('Clipboard unavailable.')) }}><Copy data-icon="inline-start" />Copy repaired script</Button>}
          </div>}
    </section>
  </aside>
}
