'use client'

import { useState, ReactNode, isValidElement } from 'react'
import ReactMarkdown from 'react-markdown'
import { Eclipse, ExternalLink, LoaderCircle, RotateCcw, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MessageScrollerProvider, MessageScroller, MessageScrollerContent, MessageScrollerViewport } from '@/components/ui/message-scroller'
import { Message, MessageContent } from '@/components/ui/message'
import { Bubble, BubbleContent } from '@/components/ui/bubble'
import { Marker, MarkerContent } from '@/components/ui/marker'
import type { Turn } from '@/lib/chat-types'

function CodeBlock({ children }: { children: ReactNode }) {
  const [copied, setCopied] = useState(false)

  const getText = (node: ReactNode): string => {
    if (typeof node === 'string' || typeof node === 'number') return String(node)
    if (Array.isArray(node)) return node.map(getText).join('')
    if (isValidElement<{ children?: ReactNode }>(node) && node.props.children) {
      return getText(node.props.children)
    }
    return ''
  }

  const rawText = getText(children)

  async function copy() {
    try {
      await navigator.clipboard.writeText(rawText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
    }
  }

  return (
    <div className="group relative my-3 overflow-hidden rounded-lg border bg-secondary/80">
      <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-1.5 text-xs text-muted-foreground">
        <span>Code Snippet</span>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs font-medium" onClick={copy}>
          {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
          {copied ? 'Copied!' : 'Copy Code'}
        </Button>
      </div>
      <div className="overflow-x-auto p-4 font-mono text-sm leading-6">
        {children}
      </div>
    </div>
  )
}

export function ChatMessages({ turns, busy, phase, onRetry }: { turns: Turn[]; busy: boolean; phase: string; onRetry: () => void }) {
  return (
    <MessageScrollerProvider>
      <MessageScroller>
        <MessageScrollerViewport>
          <MessageScrollerContent className="mx-auto max-w-[740px] px-6 py-8">
            <Marker><MarkerContent>Live conversation · Not saved after reload</MarkerContent></Marker>
            {turns.map((turn, index) => (
              <Message key={turn.id} align={turn.role === 'user' ? 'end' : 'start'}>
                <MessageContent>
                  {turn.role === 'assistant' && (
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Eclipse className="size-5 text-primary" />Luna
                    </div>
                  )}
                  {turn.warning && (
                    <p role="status" className="rounded-lg border border-border bg-secondary p-3 text-sm leading-relaxed text-secondary-foreground">
                      {turn.warning}
                    </p>
                  )}
                  {turn.text && (
                    <Bubble variant={turn.role === 'user' ? 'secondary' : 'ghost'}>
                      <BubbleContent>
                        {turn.role === 'user' ? (
                          <p className="whitespace-pre-wrap text-base leading-7">{turn.text}</p>
                        ) : (
                          <div className="flex min-w-0 flex-col gap-4 break-words text-base leading-7 [&_h1]:text-xl [&_h2]:text-lg [&_h3]:font-semibold [&_li]:mb-1 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6 [&_code]:font-mono [&_code]:text-sm">
                            <ReactMarkdown
                              skipHtml
                              components={{
                                pre: ({ children }) => <CodeBlock>{children}</CodeBlock>,
                                a: ({ href, children }) =>
                                  href && /^https?:\/\//i.test(href) ? (
                                    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
                                      {children}
                                    </a>
                                  ) : (
                                    <span>{children}</span>
                                  ),
                                img: () => null
                              }}
                            >
                              {turn.text}
                            </ReactMarkdown>
                          </div>
                        )}
                      </BubbleContent>
                    </Bubble>
                  )}
                  {!!turn.sources?.length && (
                    <section aria-label="Web sources" className="flex flex-col gap-2">
                      <h3 className="text-sm font-medium">Sources</h3>
                      {turn.sources.map(source => (
                        <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary underline-offset-4 hover:underline">
                          <ExternalLink className="size-4 shrink-0" />
                          <span className="truncate">{source.title}</span>
                        </a>
                      ))}
                    </section>
                  )}
                  {turn.error && (
                    <div role="alert" className="flex flex-col gap-3">
                      <p className="text-sm leading-relaxed">{turn.error}</p>
                      {index === turns.length - 1 && (
                        <Button variant="outline" size="sm" disabled={busy} className="w-fit" onClick={onRetry}>
                          <RotateCcw data-icon="inline-start" />Retry response
                        </Button>
                      )}
                    </div>
                  )}
                  {busy && index === turns.length - 1 && (
                    <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                      <LoaderCircle className="size-4 animate-spin" />{phase}
                    </p>
                  )}
                </MessageContent>
              </Message>
            ))}
          </MessageScrollerContent>
        </MessageScrollerViewport>
      </MessageScroller>
    </MessageScrollerProvider>
  )
}

