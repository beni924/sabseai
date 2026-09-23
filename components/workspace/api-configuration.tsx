'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Clapperboard, KeyRound, LockKeyhole, RefreshCw, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type Connection = { id: string; label: string; status: string; detail: string; placeholder?: string }
async function fetchConnections(url: string): Promise<{ connections: Connection[] }> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Connection checks could not load.')
  return response.json()
}

export function ApiConfiguration({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data, error, isLoading, isValidating, mutate } = useSWR(open ? '/api/connections' : null, fetchConnections, { revalidateOnFocus: false, shouldRetryOnError: false, dedupingInterval: 60000 })
  const [message, setMessage] = useState('')
  function clearLegacyKeys() {
    try { localStorage.removeItem('luna.developer-configuration'); setMessage('Old preview credentials have been removed from this browser.') }
    catch { setMessage('Browser storage could not be cleared. Clear site data in your browser settings.') }
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="key-dialog max-h-[90dvh] overflow-y-auto p-7 sm:max-w-lg sm:p-9">
    <DialogHeader><div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-secondary text-primary"><KeyRound className="size-5" /></div><DialogTitle>Connected services</DialogTitle><DialogDescription>Chat and audit drafts use Vercel AI Gateway. The auditor uses native Claude and Gemini credentials; research uses Tavily. Keys are never sent to the browser.</DialogDescription></DialogHeader>
    <div className="flex flex-col gap-5 pt-4">
      <div className="flex items-center justify-between"><span className="text-sm font-medium">AI Gateway</span><Badge variant="secondary">Chat provider</Badge></div>
      {isLoading && <p role="status" className="text-sm text-muted-foreground">Checking provider credentials…</p>}
      {error && <p role="alert" className="text-sm">Connection checks could not load. Please retry.</p>}
      {data?.connections.map(connection => <section key={connection.id} className="flex flex-col gap-2 border-t border-border pt-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-medium">{connection.label}</h3><Badge variant="outline">{connection.status}</Badge></div>{connection.placeholder && <p className="font-mono text-xs text-muted-foreground/70">{connection.placeholder}</p>}<p className="text-sm leading-relaxed text-muted-foreground">{connection.detail}</p></section>)}
      <section className="flex flex-col gap-2 border-t border-border pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-sm font-medium"><Clapperboard className="size-4 text-primary" />Video engine · Runway / Luma / Kling</h3><Badge variant="secondary">AI Gateway</Badge></div>
        <p className="text-sm leading-relaxed text-muted-foreground">The Video Studio renders through Vercel AI Gateway (Veo, Kling, and Seedance models). No Runway, Luma, or Kling key is entered in the browser — generation is authorized server-side. To route through a dedicated provider key, add it in Settings → Vars.</p>
      </section>
      <p className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground"><LockKeyhole className="mt-1 size-4 shrink-0" />Manage existing credentials in the v0 project’s Settings → Vars. Pinecone retrieval and persistent chat history are not enabled.</p>
      <Button variant="outline" disabled={isValidating} onClick={() => void mutate()}><RefreshCw data-icon="inline-start" />{isValidating ? 'Checking…' : 'Recheck connections'}</Button>
      <Button variant="ghost" onClick={clearLegacyKeys}><Trash2 data-icon="inline-start" />Remove old browser-stored keys</Button>
      {message && <p role="status" className="text-sm">{message}</p>}
    </div>
  </DialogContent></Dialog>
}
