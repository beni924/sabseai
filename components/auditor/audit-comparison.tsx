'use client'

import { Code2, Database, FileCheck2, Layers3 } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyMedia } from '@/components/ui/empty'
import type { AuditState, ReviewerResult } from '@/lib/auditor/types'

function ReviewNotes({ result, name }: { result?: ReviewerResult; name: string }) {
  return <section className="flex flex-col gap-4 rounded-xl border border-border p-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium">{name}</h3><Badge variant="outline">{result?.status || 'Awaiting draft'}</Badge></div>
    {!result?.review ? <p className="text-sm leading-relaxed text-muted-foreground">{result?.message || 'An independent review will appear here after the first draft.'}</p> : <>
      <p className="text-sm leading-relaxed">{result.review.summary}</p>
      {!result.review.issues.length && <p className="text-sm text-muted-foreground">No specific issues identified by this reviewer. This is not proof of correctness.</p>}
      {result.review.issues.map((issue, index) => <article key={index} className="flex flex-col gap-3 border-t border-border pt-4"><div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{issue.severity}</Badge><h4 className="text-sm font-medium">{issue.title}</h4></div><p className="text-sm leading-relaxed text-muted-foreground">{issue.explanation}</p>
        {issue.original && <div className="audit-removal rounded-lg p-3"><span className="text-sm font-medium">Original excerpt</span><pre className="mt-2 whitespace-pre-wrap break-words font-mono text-sm leading-relaxed">{issue.original}</pre></div>}
        {issue.suggested && <div className="audit-addition rounded-lg p-3"><span className="text-sm font-medium">Suggested change</span><pre className="mt-2 whitespace-pre-wrap break-words font-mono text-sm leading-relaxed">{issue.suggested}</pre></div>}
      </article>)}<p className="text-sm leading-relaxed text-muted-foreground">Review limits: {result.review.limitations}</p>
    </>}
  </section>
}

export function AuditComparison({ state }: { state: AuditState }) {
  return <section className="flex min-w-0 flex-col" aria-label="Draft comparison">
    <header className="flex flex-col gap-2 px-7 pt-7 pb-5"><div className="flex items-center gap-2 text-sm text-primary"><Layers3 className="size-4" />THE COMPARISON DESK</div><h1 className="font-serif text-3xl tracking-tight text-balance">A second look.<br />A stronger answer.</h1><p className="max-w-md text-sm leading-relaxed text-muted-foreground">One draft. Two independent perspectives. Every suggested change, out in the open.</p></header>
    <Tabs defaultValue="draft" className="min-w-0 flex-1">
      <div className="overflow-x-auto border-y border-border px-5 py-3"><TabsList variant="line" aria-label="Audit comparison views"><TabsTrigger value="context"><Database />Context</TabsTrigger><TabsTrigger value="draft"><Code2 />Initial draft</TabsTrigger><TabsTrigger value="reviews"><FileCheck2 />Audit notes{Object.keys(state.reviews).length > 0 && ` (${Object.keys(state.reviews).length})`}</TabsTrigger></TabsList></div>
      <TabsContent value="context" className="p-6"><Empty className="min-h-80"><EmptyHeader><EmptyMedia variant="icon"><Database /></EmptyMedia><EmptyTitle>No private context retrieved</EmptyTitle><EmptyDescription>Pinecone retrieval is not enabled. An approved index, namespace, text mapping, and compatible embedding model are required. The pipeline can continue without it.</EmptyDescription></EmptyHeader></Empty><p className="text-sm leading-relaxed text-muted-foreground">Retrieved context would be reference material, not verified truth. No index is selected or queried automatically.</p></TabsContent>
      <TabsContent value="draft" className="p-6">{state.draft ? <div className="flex flex-col gap-4"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">Original · never overwritten</span><Badge variant="outline">{state.phases.draft.status}</Badge></div><pre className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed">{state.draft}</pre></div> : <Empty className="min-h-96"><EmptyHeader><EmptyMedia variant="icon"><Code2 /></EmptyMedia><EmptyTitle>{state.phases.draft.status === 'running' ? 'Your first draft is taking shape' : 'Good work starts with a first draft'}</EmptyTitle><EmptyDescription>Describe your challenge on the left. Your original answer stays here, untouched, while Claude and Gemini take a closer look.</EmptyDescription></EmptyHeader></Empty>}</TabsContent>
      <TabsContent value="reviews" className="p-6"><div className="flex flex-col gap-5"><p className="text-sm leading-relaxed text-muted-foreground">Review summaries and proposed fixes — not hidden model reasoning or executed test results.</p><ReviewNotes name="Claude · native review" result={state.reviews.claude} /><ReviewNotes name="Gemini · independent review" result={state.reviews.gemini} /></div></TabsContent>
    </Tabs>
    <footer className="flex items-center gap-2 border-t border-border px-6 py-4 text-sm text-muted-foreground"><LockNote />{state.runId ? `Run ${state.runId.slice(0, 8)} · session only` : 'Your work stays in this session. Export before leaving.'}</footer>
  </section>
}

function LockNote() { return <FileCheck2 className="size-4 shrink-0" /> }
