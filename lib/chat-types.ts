import { openai } from '@ai-sdk/openai'
import { google } from '@ai-sdk/google'

export const models = {
  luna: { id: openai('gpt-4o'), label: 'GPT-4o (OpenAI)' },
  gemini: { id: google('gemini-1.5-flash'), label: 'Gemini 1.5 Flash (Google)' },
} as const

export type ModelChoice = keyof typeof models
export type Source = { title: string; url: string }
export type ContextFile = { name: string; text: string }
export type Turn = {
  id: string
  role: 'user' | 'assistant'
  text: string
  context?: string
  sources?: Source[]
  warning?: string
  error?: string
}
export type ChatEvent =
  | { type: 'status'; message: string }
  | { type: 'sources'; sources: Source[] }
  | { type: 'warning' | 'error'; message: string }
  | { type: 'text'; text: string }
  | { type: 'done' }

export type Conversation = {
  id: string
  title: string
  turns: Turn[]
  createdAt: number
  updatedAt: number
}

