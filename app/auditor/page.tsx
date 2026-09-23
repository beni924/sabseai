import type { Metadata } from 'next'
import { AuditorWorkspace } from '@/components/auditor/auditor-workspace'

export const metadata: Metadata = {
  title: 'Code Auditor — Luna',
  description: 'Compare an original draft with independent Claude and Gemini reviews and live research. Suggested code is never executed.',
  robots: { index: false, follow: false },
}

export default function AuditorPage() {
  return <AuditorWorkspace />
}
