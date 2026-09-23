import type { Metadata, Viewport } from 'next'
import { Geist, Lora } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--loaded-sans' })
const lora = Lora({ subsets: ['latin'], variable: '--loaded-serif' })

export const metadata: Metadata = {
  title: 'Luna — A little space for big ideas',
  description: 'A calm AI workspace with chat navigation, a sandbox code matrix, video production studio, and market-analysis prompts. Write, research, and build with cited sources.',
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#fbf9f6',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`light bg-background ${geist.variable} ${lora.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
