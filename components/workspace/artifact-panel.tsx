'use client'

import { useState } from 'react'
import { FileCode2, X, Copy, Check, Download, Code2, Eye, FileText, CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

const files = [
  {
    name: 'AQuietBeginning.tsx',
    language: 'tsx',
    code: `export default function AQuietBeginning() {
  return (
    <main className="welcome">
      <span>A QUIET BEGINNING</span>
      <h1>Less noise.\nMore possibility.</h1>
      <p>
        A thoughtful place for your next idea.
        Make room for the things that matter.
      </p>
    </main>
  )
}`
  },
  {
    name: 'a-quiet-beginning.md',
    language: 'markdown',
    code: `# A quiet beginning

Less noise. More possibility.

A thoughtful place for your next idea. Make room for the things that matter.

## A few principles

- Start with a little curiosity.
- Make something meaningful.
- Leave room to grow.

This is a sample artifact in the Luna workspace preview.`
  }
]

export function ArtifactPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState('preview')
  const [activeFileIndex, setActiveFileIndex] = useState(0)
  const [copied, setCopied] = useState(false)
  const [copiedAll, setCopiedAll] = useState(false)
  const [error, setError] = useState('')

  const allCodeCombined = files.map(f => `// ==========================================\n// File: ${f.name}\n// ==========================================\n\n${f.code}`).join('\n\n\n')
  const currentContent = tab === 'code' ? files[activeFileIndex].code : files[1].code

  async function copyCurrent() {
    try {
      await navigator.clipboard.writeText(currentContent)
      setCopied(true)
      setError('')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Clipboard access is unavailable. Use Download instead.')
    }
  }

  async function copyEverything() {
    try {
      await navigator.clipboard.writeText(allCodeCombined)
      setCopiedAll(true)
      setError('')
      setTimeout(() => setCopiedAll(false), 2000)
    } catch {
      setError('Clipboard access is unavailable. Use Download instead.')
    }
  }

  function download() {
    const content = tab === 'code' ? files[activeFileIndex].code : allCodeCombined
    const filename = tab === 'code' ? files[activeFileIndex].name : 'workspace-all-code.txt'
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <aside aria-label="Artifacts panel" className="artifact-enter fixed inset-0 z-40 flex flex-col border-l bg-background text-foreground shadow-xl md:relative md:z-auto md:w-[42%] md:min-w-80 md:shadow-none">
      <header className="flex h-[76px] shrink-0 items-center justify-between border-b px-5">
        <div className="flex items-center gap-2.5">
          <FileCode2 className="size-[18px] text-primary" />
          <span className="font-medium">Artifacts & Code</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="default" size="sm" className="gap-1.5 font-medium" onClick={copyEverything}>
            {copiedAll ? <CheckCheck className="size-4" /> : <Copy className="size-4" />}
            <span>{copiedAll ? 'Copied Everything!' : 'Copy Everything'}</span>
          </Button>
          <Button variant="ghost" size="icon" aria-label="Close artifacts" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
      </header>

      <Tabs value={tab} onValueChange={value => setTab(String(value))} className="min-h-0 flex-1 gap-0 flex flex-col">
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <TabsList>
            <TabsTrigger value="preview"><Eye className="size-3.5" />Preview</TabsTrigger>
            <TabsTrigger value="code"><Code2 className="size-3.5" />Code ({files.length})</TabsTrigger>
            <TabsTrigger value="markdown"><FileText className="size-3.5" />Text</TabsTrigger>
          </TabsList>
          
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={copyCurrent}>
            {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
            {copied ? 'Copied File' : 'Copy View'}
          </Button>
        </div>

        <TabsContent value="preview" className="overflow-y-auto p-6 flex-1">
          <div className="flex min-h-[380px] flex-col justify-center rounded-xl border bg-secondary/40 px-8 py-12">
            <span className="text-sm tracking-[.15em] text-primary">A QUIET BEGINNING</span>
            <h2 className="mt-6 font-serif text-4xl leading-tight text-balance">Less noise.<br />More possibility.</h2>
            <p className="mt-6 max-w-64 text-base leading-relaxed text-muted-foreground">A thoughtful place for your next idea. Make room for the things that matter.</p>
            <div className="mt-12 h-px w-12 bg-primary/50" />
          </div>
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Sample component preview</p>
            <Button size="sm" variant="secondary" onClick={copyEverything} className="gap-1.5">
              {copiedAll ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
              <span>{copiedAll ? 'Copied Everything' : 'Copy All Code'}</span>
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="code" className="overflow-hidden flex-1 flex flex-col p-0">
          <div className="flex items-center gap-1 border-b bg-muted/30 px-4 py-2 overflow-x-auto text-xs">
            {files.map((file, idx) => (
              <button
                key={file.name}
                onClick={() => setActiveFileIndex(idx)}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-colors ${
                  activeFileIndex === idx
                    ? 'bg-background font-medium text-foreground shadow-xs border'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Code2 className="size-3" />
                {file.name}
              </button>
            ))}
          </div>
          <div className="relative overflow-auto p-6 flex-1 bg-secondary/20">
            <pre className="font-mono text-sm leading-6">
              <code>{files[activeFileIndex].code}</code>
            </pre>
          </div>
        </TabsContent>

        <TabsContent value="markdown" className="overflow-auto p-6 flex-1">
          <article className="flex flex-col gap-5 leading-relaxed">
            <h2 className="font-serif text-3xl">A quiet beginning</h2>
            <p>Less noise. More possibility.</p>
            <p>A thoughtful place for your next idea. Make room for the things that matter.</p>
            <h3 className="text-lg font-medium">A few principles</h3>
            <ul className="ml-5 flex list-disc flex-col gap-2">
              <li>Start with a little curiosity.</li>
              <li>Make something meaningful.</li>
              <li>Leave room to grow.</li>
            </ul>
            <p className="text-muted-foreground">This is a sample artifact in the Luna workspace preview.</p>
          </article>
        </TabsContent>
      </Tabs>

      {error && <p role="status" className="px-5 py-2 text-sm text-destructive">{error}</p>}

      <footer className="flex items-center justify-between border-t p-4 bg-muted/10">
        <Button variant="default" size="sm" onClick={copyEverything} className="gap-2 font-medium">
          {copiedAll ? <CheckCheck className="size-4" /> : <Copy className="size-4" />}
          <span>{copiedAll ? 'Copied Everything!' : 'Copy Everything'}</span>
        </Button>
        <Button variant="outline" size="sm" onClick={download}>
          <Download className="size-4 mr-1.5" />
          Download
        </Button>
      </footer>
    </aside>
  )
}

