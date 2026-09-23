'use client'

import { useState, useRef, useEffect } from 'react'
import { Eclipse, PanelLeftClose, Plus, Search, MessageSquare, Settings2, X, Pencil, Trash2, Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Conversation } from '@/lib/chat-types'

function groupConversationsByDate(conversations: Conversation[]) {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterdayStart = todayStart - 86400000
  const weekStart = todayStart - 86400000 * 7

  const today: Conversation[] = []
  const yesterday: Conversation[] = []
  const previousWeek: Conversation[] = []
  const older: Conversation[] = []

  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt)

  for (const conv of sorted) {
    if (conv.updatedAt >= todayStart) {
      today.push(conv)
    } else if (conv.updatedAt >= yesterdayStart) {
      yesterday.push(conv)
    } else if (conv.updatedAt >= weekStart) {
      previousWeek.push(conv)
    } else {
      older.push(conv)
    }
  }

  return [
    { label: 'Today', items: today },
    { label: 'Yesterday', items: yesterday },
    { label: 'Previous 7 Days', items: previousWeek },
    { label: 'Older', items: older },
  ].filter(group => group.items.length > 0)
}

export function WorkspaceSidebar({
  open,
  onClose,
  onNew,
  onSelect,
  onDelete,
  onRename,
  onConfigure,
  activeId,
  conversations,
}: {
  open: boolean
  onClose: () => void
  onNew: () => void
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onRename: (id: string, newTitle: string) => void
  onConfigure: () => void
  activeId: string | null
  conversations: Conversation[]
}) {
  const [search, setSearch] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId) {
      editInputRef.current?.focus()
      editInputRef.current?.select()
    }
  }, [editingId])

  function startRename(conv: Conversation, e: React.MouseEvent) {
    e.stopPropagation()
    setEditingId(conv.id)
    setEditTitle(conv.title)
  }

  function saveRename(id: string) {
    if (editTitle.trim()) {
      onRename(id, editTitle.trim())
    }
    setEditingId(null)
  }

  const query = (search || '').toLowerCase().trim()
  const filteredConversations = conversations.filter(conv => {
    if (!query) return true
    if (conv.title.toLowerCase().includes(query)) return true
    return conv.turns.some(t => t.text.toLowerCase().includes(query))
  })

  const groups = groupConversationsByDate(filteredConversations)

  return (
    <>
      {open && (
        <button
          className="fixed inset-0 z-20 bg-foreground/20 md:hidden"
          aria-label="Close navigation backdrop"
          onClick={onClose}
        />
      )}
      <aside
        aria-label="Chat history navigation"
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex w-72 shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-[margin,transform] duration-300 md:relative md:z-auto',
          open ? 'translate-x-0' : '-translate-x-full md:-ml-72'
        )}
        inert={!open}
      >
        {/* Pinned Header */}
        <div className="flex shrink-0 flex-col gap-3 border-b border-border/50 p-4">
          <div className="flex items-center justify-between px-2">
            <button onClick={onNew} className="flex items-center gap-2.5" aria-label="Luna home">
              <Eclipse className="size-7 text-primary" strokeWidth={1.45} />
              <span className="font-serif text-3xl tracking-tight">luna</span>
            </button>
            <button className="icon-button" aria-label="Collapse sidebar" onClick={onClose}>
              <PanelLeftClose className="size-5" />
            </button>
          </div>

          {/* Pinned "New Chat" Button */}
          <Button
            variant="default"
            size="default"
            className="w-full justify-start gap-2.5 font-medium shadow-xs"
            onClick={onNew}
          >
            <Plus className="size-4" />
            New Chat
          </Button>

          {/* Search Toggle / Search Input */}
          {search !== null ? (
            <div className="flex items-center gap-1.5">
              <Input
                autoFocus
                aria-label="Search chats"
                placeholder="Search history…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-8 text-xs"
              />
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                onClick={() => setSearch(null)}
                aria-label="Clear search"
              >
                <X className="size-4" />
              </Button>
            </div>
          ) : (
            <button
              className="sidebar-link text-xs"
              aria-expanded={false}
              onClick={() => setSearch('')}
            >
              <Search className="size-3.5" />
              Search chats
            </button>
          )}
        </div>

        {/* Scrollable Conversation List */}
        <nav className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4" aria-label="Recent Chats">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              History
            </h2>
            <span className="text-xs text-muted-foreground">{conversations.length} saved</span>
          </div>

          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center px-4">
              <MessageSquare className="size-8 text-muted-foreground/40 mb-2" strokeWidth={1.2} />
              <p className="text-sm font-medium text-muted-foreground">No conversations yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Your chat history will be automatically saved here.
              </p>
            </div>
          ) : groups.length === 0 ? (
            <p className="px-2 text-xs text-muted-foreground">No matching chats found.</p>
          ) : (
            groups.map(group => (
              <section key={group.label} className="flex flex-col gap-1">
                <h3 className="px-2 text-[11px] font-medium uppercase text-muted-foreground/70">
                  {group.label}
                </h3>
                <div className="flex flex-col gap-1">
                  {group.items.map(conv => {
                    const isActive = activeId === conv.id
                    const isEditing = editingId === conv.id
                    const lastTurn = conv.turns[conv.turns.length - 1]
                    const preview = lastTurn ? lastTurn.text.replace(/\s+/g, ' ').trim() : ''

                    if (isEditing) {
                      return (
                        <div key={conv.id} className="flex items-center gap-1 px-2 py-1 bg-background rounded-md border">
                          <Input
                            ref={editInputRef}
                            value={editTitle}
                            onChange={e => setEditTitle(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveRename(conv.id)
                              if (e.key === 'Escape') setEditingId(null)
                            }}
                            className="h-7 text-xs border-none p-1 focus-visible:ring-0"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 shrink-0 text-emerald-500 hover:text-emerald-600"
                            onClick={() => saveRename(conv.id)}
                            aria-label="Confirm rename"
                          >
                            <Check className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 shrink-0 text-muted-foreground"
                            onClick={() => setEditingId(null)}
                            aria-label="Cancel rename"
                          >
                            <X className="size-3.5" />
                          </Button>
                        </div>
                      )
                    }

                    return (
                      <div
                        key={conv.id}
                        onClick={() => onSelect(conv.id)}
                        className={cn(
                          'group relative flex cursor-pointer items-start justify-between rounded-lg px-2.5 py-2 transition-colors hover:bg-muted/60',
                          isActive ? 'bg-background shadow-xs font-medium text-foreground' : 'text-muted-foreground'
                        )}
                      >
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5 pr-2">
                          <div className="flex items-center gap-2">
                            <MessageSquare
                              className={cn(
                                'size-3.5 shrink-0',
                                isActive ? 'text-primary' : 'text-muted-foreground/70'
                              )}
                              strokeWidth={1.5}
                            />
                            <span className="truncate text-xs font-medium text-foreground">
                              {conv.title}
                            </span>
                          </div>
                          {preview && (
                            <p className="truncate pl-5 text-[11px] text-muted-foreground/70">
                              {preview}
                            </p>
                          )}
                        </div>

                        {/* Action buttons on hover */}
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            type="button"
                            className="rounded p-1 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                            onClick={e => startRename(conv, e)}
                            title="Rename"
                            aria-label={`Rename ${conv.title}`}
                          >
                            <Pencil className="size-3" />
                          </button>
                          <button
                            type="button"
                            className="rounded p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            onClick={e => {
                              e.stopPropagation()
                              onDelete(conv.id)
                            }}
                            title="Delete"
                            aria-label={`Delete ${conv.title}`}
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            ))
          )}
        </nav>

        {/* Footer */}
        <div className="flex shrink-0 flex-col gap-3 border-t border-border p-4">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs" onClick={onConfigure}>
            <Settings2 className="size-3.5" />
            API Key Settings
          </Button>
        </div>
      </aside>
    </>
  )
}

