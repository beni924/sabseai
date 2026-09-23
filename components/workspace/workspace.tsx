'use client'

import { useEffect, useState } from 'react'
import { Eclipse, PanelLeftOpen, PanelRight, ChevronDown, Check, LockKeyhole, Sparkles, MessagesSquare, Clapperboard } from 'lucide-react'
import { WorkspaceSidebar } from './workspace-sidebar'
import { ApiConfiguration } from './api-configuration'
import { ChatComposer } from './chat-composer'
import { ArtifactPanel } from './artifact-panel'
import { VideoStudio } from './video-studio'
import { WorkspaceModes } from './workspace-modes'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ChatMessages } from './chat-messages'
import { useLunaChat } from '@/hooks/use-luna-chat'
import { models, type ContextFile, type ModelChoice, type Conversation } from '@/lib/chat-types'
import { cn } from '@/lib/utils'

export function Workspace() {
  const [sidebar, setSidebar] = useState(true)
  const [configuration, setConfiguration] = useState(false)
  const [artifacts, setArtifacts] = useState(false)
  const [view, setView] = useState<'chat' | 'studio'>('chat')
  const [draft, setDraft] = useState('')
  const [financeMode, setFinanceMode] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [model, setModel] = useState<ModelChoice>('luna')
  const [web, setWeb] = useState(false)
  const { turns, busy, phase, send: sendLive, retry, reset, loadTurns, stop } = useLunaChat()

  useEffect(() => {
    if (window.innerWidth < 768) setSidebar(false)
    try {
      const saved = localStorage.getItem('luna_conversations')
      if (saved) {
        const parsed = JSON.parse(saved) as Conversation[]
        if (Array.isArray(parsed)) {
          setConversations(parsed)
        }
      }
    } catch {
      // Storage unavailable or invalid JSON
    }
    setIsLoaded(true)
  }, [])

  useEffect(() => {
    if (!isLoaded) return
    try {
      localStorage.setItem('luna_conversations', JSON.stringify(conversations))
    } catch {
      // Storage unavailable
    }
  }, [conversations, isLoaded])

  useEffect(() => {
    if (!activeId || turns.length === 0) return
    setConversations(prev => {
      const index = prev.findIndex(c => c.id === activeId)
      if (index !== -1) {
        const updated = [...prev]
        updated[index] = { ...updated[index], turns, updatedAt: Date.now() }
        return updated
      } else {
        const firstUserTurn = turns.find(t => t.role === 'user')
        const rawText = firstUserTurn ? firstUserTurn.text.replace(/\s+/g, ' ').trim() : ''
        const title = rawText.slice(0, 45) || 'New Chat'
        const newConv: Conversation = {
          id: activeId,
          title,
          turns,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        return [newConv, ...prev]
      }
    })
  }, [turns, activeId])

  function newConversation() {
    reset()
    setActiveId(null)
    setDraft('')
    setArtifacts(false)
    setView('chat')
    setFinanceMode(false)
    if (window.innerWidth < 768) setSidebar(false)
  }

  function selectConversation(id: string) {
    const conv = conversations.find(c => c.id === id)
    if (conv) {
      reset()
      setActiveId(conv.id)
      loadTurns(conv.turns)
      setDraft('')
      setView('chat')
      if (window.innerWidth < 768) setSidebar(false)
    }
  }

  function deleteConversation(id: string) {
    setConversations(prev => prev.filter(c => c.id !== id))
    if (activeId === id) {
      newConversation()
    }
  }

  function renameConversation(id: string, newTitle: string) {
    setConversations(prev => prev.map(c => (c.id === id ? { ...c, title: newTitle } : c)))
  }

  function selectFinance() {
    setFinanceMode(true)
    setDraft('[Market analytics mode] Analyze the following ticker or market question. Cite dated sources, distinguish facts from assumptions, and do not invent live quotes: ')
    document.querySelector<HTMLTextAreaElement>('textarea')?.focus()
  }

  function send(text: string, files: ContextFile[] = []) {
    if (busy) return
    let currentId = activeId
    if (!currentId) {
      currentId = crypto.randomUUID()
      setActiveId(currentId)
    }
    sendLive(text, files, model, web)
  }

  const activeConv = conversations.find(c => c.id === activeId)
  const activeTitle = activeConv ? activeConv.title : null

  return (
    <div className="workspace-theme flex h-dvh min-h-0 overflow-hidden bg-background text-foreground">
      <WorkspaceSidebar
        open={sidebar}
        onClose={() => setSidebar(false)}
        onNew={newConversation}
        onSelect={selectConversation}
        onDelete={deleteConversation}
        onRename={renameConversation}
        onConfigure={() => setConfiguration(true)}
        activeId={activeId}
        conversations={conversations}
      />
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[76px] shrink-0 items-center justify-between px-4 md:px-7">
          <div className="flex w-10 items-center md:w-28">{!sidebar && <Button variant="ghost" size="icon" aria-label="Expand sidebar" onClick={() => setSidebar(true)}><PanelLeftOpen /></Button>}<button className={cn('icon-button md:hidden', !sidebar && 'hidden')} aria-label="Open navigation" onClick={() => setSidebar(true)}><PanelLeftOpen className="size-4" /></button></div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg bg-secondary/60 p-1" role="tablist" aria-label="Workspace view">
              <button role="tab" aria-selected={view === 'chat'} onClick={() => setView('chat')} className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors', view === 'chat' ? 'bg-background font-medium text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground')}><MessagesSquare className="size-4" />Chat</button>
              <button role="tab" aria-selected={view === 'studio'} onClick={() => setView('studio')} className={cn('flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors', view === 'studio' ? 'bg-background font-medium text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground')}><Clapperboard className="size-4" />Video studio</button>
            </div>
            {view === 'chat' && <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" className="h-10 gap-2.5" disabled={busy} />}><span className="text-sm font-medium sm:text-base"><span className="sm:hidden">Luna</span><span className="hidden sm:inline">{models[model].label}</span></span><ChevronDown /></DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-72 p-2"><DropdownMenuGroup><DropdownMenuLabel>Choose your engine · AI Gateway</DropdownMenuLabel>{(Object.keys(models) as ModelChoice[]).map(choice => <DropdownMenuItem key={choice} className="py-3" onClick={() => setModel(choice)}><Eclipse /><span className="flex-1">{models[choice].label}</span>{model === choice && <Check />}</DropdownMenuItem>)}</DropdownMenuGroup></DropdownMenuContent>
            </DropdownMenu>}
          </div>
          <div className="flex w-10 justify-end md:w-28">
            {view === 'chat' && (
              <Button variant="ghost" className="gap-2" aria-label="Toggle artifacts" aria-pressed={artifacts} onClick={() => setArtifacts(!artifacts)}>
                <PanelRight />
                <span className="hidden font-normal md:inline">Artifacts</span>
              </Button>
            )}
          </div>
        </header>
        {view === 'studio' ? (
          <VideoStudio />
        ) : turns.length === 0 ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5">
            <div className="flex min-h-fit flex-1 items-center justify-center py-8 md:pb-24">
              <section className="welcome-enter flex w-full max-w-[740px] flex-col items-center">
                <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground"><span className="size-1.5 rounded-full bg-primary/80" />A little space for big ideas</div>
                <div className="mb-4 flex items-center gap-4"><Eclipse aria-hidden="true" className="size-10 shrink-0 text-primary md:size-11" strokeWidth={1.15} /><h1 className="font-serif text-4xl font-normal leading-tight tracking-tight text-balance md:text-[46px]">{activeTitle || 'Where shall we begin?'}</h1></div>
                <p className="mb-9 text-center text-base leading-relaxed text-muted-foreground">A thought, a question, a half-formed idea. It all starts here.</p>
                {activeTitle && <p className="mb-5 text-sm text-muted-foreground">Saved chat · {activeTitle}</p>}
                <div className="flex w-full flex-col gap-5">
                  <WorkspaceModes onVideo={() => setView('studio')} onFinance={selectFinance} financeActive={financeMode} />
                  {financeMode && <p role="status" className="text-sm leading-relaxed text-muted-foreground">Market analytics context is ready. Add a ticker or question below. Live quotes and charts are not connected to this chat.</p>}
                  <ChatComposer value={draft} onChange={setDraft} onSend={send} busy={busy} onStop={stop} web={web} onWebChange={setWeb} />
                </div>
                <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground"><Sparkles className="size-3.5" strokeWidth={1.5} />A few good minds. One quiet workspace.</p>
              </section>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-center px-6 pb-2"><h1 className="truncate text-sm text-muted-foreground">{activeTitle}</h1></div>
            <ChatMessages turns={turns} busy={busy} phase={phase} onRetry={retry} />
            <div className="mx-auto w-full max-w-[788px] shrink-0 px-6 pb-4"><ChatComposer value={draft} onChange={setDraft} onSend={send} busy={busy} onStop={stop} web={web} onWebChange={setWeb} /></div>
          </div>
        )}
        <footer className="flex shrink-0 flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 pb-5 pt-2 text-center text-sm text-muted-foreground/80"><LockKeyhole className="size-3.5" /><span>Your ideas, your space.</span><span className="hidden sm:inline">Thoughtfully connected.</span><span className="mx-1 text-muted-foreground/40">·</span><span>AI can make mistakes. Verify important information.</span></footer>
      </main>
      {artifacts && <ArtifactPanel onClose={() => setArtifacts(false)} />}
      <ApiConfiguration open={configuration} onOpenChange={setConfiguration} />
    </div>
  )
}

