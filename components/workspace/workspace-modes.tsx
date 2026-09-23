'use client'

import Link from 'next/link'
import { Code2, Clapperboard, ChartNoAxesCombined, ArrowUpRight } from 'lucide-react'

export function WorkspaceModes({ onVideo, onFinance, financeActive }: { onVideo: () => void; onFinance: () => void; financeActive: boolean }) {
  return <nav aria-label="Quick-action modes" className="flex w-full flex-col gap-3 sm:flex-row">
    <Link href="/auditor" className="mode-shortcut mode-code"><Code2 className="size-5" /><span className="flex flex-1 flex-col gap-1"><span className="text-sm font-medium">Sandbox Code Matrix</span><span className="text-sm opacity-75">Build, review, run</span></span><ArrowUpRight className="size-4" /></Link>
    <button onClick={onVideo} className="mode-shortcut mode-video"><Clapperboard className="size-5" /><span className="flex flex-1 flex-col gap-1"><span className="text-sm font-medium">AI Video Production Studio</span><span className="text-sm opacity-75">Turn a scene into a clip</span></span><ArrowUpRight className="size-4" /></button>
    <button onClick={onFinance} aria-pressed={financeActive} className="mode-shortcut mode-finance"><ChartNoAxesCombined className="size-5" /><span className="flex flex-1 flex-col gap-1"><span className="text-sm font-medium">Market Analytics Engine</span><span className="text-sm opacity-75">Explore with context</span></span><ArrowUpRight className="size-4" /></button>
  </nav>
}
