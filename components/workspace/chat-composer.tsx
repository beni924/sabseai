'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Paperclip, Globe, FileText, X, Square } from 'lucide-react'
import { InputGroup, InputGroupTextarea, InputGroupAddon, InputGroupButton } from '@/components/ui/input-group'
import { Attachment, AttachmentContent, AttachmentTitle, AttachmentAction } from '@/components/ui/attachment'
import type { ContextFile } from '@/lib/chat-types'

export function ChatComposer({ onSend, value, onChange, busy, onStop, web, onWebChange }: { onSend: (text: string, files: ContextFile[]) => void; value: string; onChange: (value: string) => void; busy: boolean; onStop: () => void; web: boolean; onWebChange: (value: boolean) => void }) {
  const fileInput = useRef<HTMLInputElement>(null)
  const textarea = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (!textarea.current) return
    textarea.current.style.height = 'auto'
    textarea.current.style.height = `${Math.min(textarea.current.scrollHeight, 240)}px`
  }, [value])
  const [files, setFiles] = useState<File[]>([])
  const [reading, setReading] = useState(false)
  const [error, setError] = useState('')
  const submitting = useRef(false)
  async function submit() {
    if (!value.trim() || busy || submitting.current) return
    submitting.current = true
    setReading(true)
    setError('')
    try {
      const context = await Promise.all(files.map(async file => ({ name: file.name, text: await file.text() })))
      if (context.reduce((n, file) => n + file.text.length, value.length) > 45000) throw new Error('Keep your message and attached text under 45,000 characters in total.')
      onSend(value.trim(), context)
      onChange('')
      setFiles([])
      if (fileInput.current) fileInput.current.value = ''
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not read the attachment.') }
    finally { submitting.current = false; setReading(false) }
  }
  return <form onSubmit={event => { event.preventDefault(); void submit() }} className="w-full">
    <InputGroup className="composer">
      <InputGroupTextarea ref={textarea} aria-label="Message Luna" placeholder="What’s on your mind?" value={value} maxLength={12000} onChange={event => onChange(event.target.value)} onKeyDown={event => { if (event.nativeEvent.isComposing || event.keyCode === 229) return; if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void submit() } }} />
      {!!files.length && <InputGroupAddon align="block-start" className="flex-wrap">{files.map((file, index) => <Attachment key={`${file.name}-${index}`}><AttachmentContent><AttachmentTitle><FileText className="mr-2 inline size-4" />{file.name}</AttachmentTitle></AttachmentContent><AttachmentAction aria-label={`Remove ${file.name}`} disabled={reading || busy} onClick={() => setFiles(previous => previous.filter((_, i) => i !== index))}><X /></AttachmentAction></Attachment>)}</InputGroupAddon>}
      <InputGroupAddon align="block-end" className="justify-between">
        <div className="flex items-center gap-1">
          <InputGroupButton type="button" size="icon-sm" aria-label="Attach text files" title="Attach text, Markdown, CSV, JSON, or code (45 KB total)" disabled={reading || busy} onClick={() => fileInput.current?.click()}><Paperclip /></InputGroupButton>
          <InputGroupButton type="button" size="icon-sm" aria-label={web ? 'Disable web search' : 'Enable web search'} aria-pressed={web} title="Search the live web with Tavily" variant={web ? 'secondary' : 'ghost'} disabled={busy} onClick={() => onWebChange(!web)}><Globe /></InputGroupButton>
          <span className="text-sm text-muted-foreground">{web ? 'Web search on' : 'Web search off'}</span>
        </div>
        <div className="flex items-center gap-3"><span className="hidden text-sm font-normal text-muted-foreground/75 sm:inline">{reading ? 'Reading files…' : 'Luna, at your pace'}</span>{busy ? <InputGroupButton type="button" size="icon-sm" variant="default" aria-label="Stop response" onClick={onStop}><Square /></InputGroupButton> : <InputGroupButton type="submit" size="icon-sm" variant="default" aria-label="Send message" disabled={!value.trim() || reading}><ArrowUp /></InputGroupButton>}</div>
      </InputGroupAddon>
    </InputGroup>
    <input ref={fileInput} type="file" accept=".txt,.md,.csv,.json,.js,.jsx,.ts,.tsx,.py,.html,.css,.xml,.yaml,.yml" multiple className="sr-only" tabIndex={-1} aria-label="Select context files" onChange={event => {
      const selected = Array.from(event.target.files || [])
      event.target.value = ''
      if (selected.some(file => !/\.(txt|md|csv|json|js|jsx|ts|tsx|py|html|css|xml|yaml|yml)$/i.test(file.name))) { setError('Use a text, Markdown, CSV, JSON, or code file. PDF and Office files are not supported yet.'); return }
      if (files.length + selected.length > 5 || [...files, ...selected].reduce((n, file) => n + file.size, 0) > 45000) { setError('Attach up to 5 text files, totaling at most 45 KB.'); return }
      setFiles(previous => [...previous, ...selected]); setError('')
    }} />
    {error && <p role="alert" className="pt-3 text-sm leading-relaxed text-muted-foreground">{error}</p>}
  </form>
}
