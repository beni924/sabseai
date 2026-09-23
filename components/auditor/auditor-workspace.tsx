'use client'

import Link from 'next/link'
import { ArrowLeft, Eclipse, ShieldCheck, Info } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AuditController } from './audit-controller'
import { AuditComparison } from './audit-comparison'
import { AuditArtifact } from './audit-artifact'
import { useAudit } from '@/hooks/use-audit'

export function AuditorWorkspace() {
  const { state, run, cancel } = useAudit()
  return <div className="auditor-theme min-h-dvh bg-background font-sans text-foreground">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-5"><div className="flex items-center gap-5"><Link href="/" aria-label="Back to Luna" className="flex items-center gap-2"><Eclipse className="size-7 text-primary" strokeWidth={1.5} /><span className="font-serif text-3xl tracking-tight">luna</span></Link><span className="border-l border-border pl-5 text-sm font-medium">Code auditor</span></div><div className="flex items-center gap-5"><span className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex"><ShieldCheck className="size-4" />Server-side credentials</span><Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Back to workspace</Link></div></header>
    {state.notices.length > 0 && <div className="border-b border-border px-6 py-4"><Alert><Info /><AlertTitle>Run notes</AlertTitle><AlertDescription><ul className="flex flex-col gap-1">{state.notices.map((notice, index) => <li key={index}>{notice}</li>)}</ul></AlertDescription></Alert></div>}
    <p className="sr-only" role="status" aria-live="polite">Audit {state.status}.</p>
    <main className="audit-grid grid min-h-[calc(100dvh-85px)]"><AuditController state={state} onRun={(prompt, engine) => void run(prompt, engine)} onCancel={cancel} /><AuditComparison state={state} /><AuditArtifact key={state.runId || 'idle'} state={state} /></main>
  </div>
}
