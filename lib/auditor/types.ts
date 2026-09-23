import { z } from 'zod'

export const engines = {
  luna: { label: 'Luna', model: 'openai/gpt-5.6-luna', detail: 'OpenAI · AI Gateway' },
  astra: { label: 'Astra', model: 'openai/gpt-6-astra', detail: 'OpenAI · AI Gateway' },
} as const
export type Engine = keyof typeof engines
export const phaseIds = ['retrieval', 'draft', 'critique', 'research'] as const
export type PhaseId = typeof phaseIds[number]
export const statusSchema = z.enum(['pending', 'running', 'completed', 'skipped', 'failed', 'cancelled'])
export type PhaseStatus = z.infer<typeof statusSchema>
export type Phase = { status: PhaseStatus; detail: string; durationMs?: number }
export const reviewSchema = z.object({
  summary: z.string().max(1800),
  issues: z.array(z.object({
    severity: z.enum(['critical', 'warning', 'suggestion']),
    title: z.string().max(200),
    explanation: z.string().max(1200),
    original: z.string().max(1600),
    suggested: z.string().max(2000),
  })).max(8),
  limitations: z.string().max(1200),
})
export type Review = z.infer<typeof reviewSchema>
export const sourceSchema = z.object({ title: z.string().max(500), url: z.string().url().max(2000).refine(url => /^https?:\/\//i.test(url)), content: z.string().max(3000) })
export type Source = z.infer<typeof sourceSchema>
export const assessmentSchema = z.object({
  claims: z.array(z.object({ claim: z.string().max(500), assessment: z.enum(['supported', 'contradicted', 'unresolved']), explanation: z.string().max(1000), sourceIds: z.array(z.number().int().min(1).max(4)).max(4) })).max(4),
})
export type Assessment = z.infer<typeof assessmentSchema>
export const executionAttemptSchema = z.object({
  attempt: z.number().int().min(1).max(3),
  code: z.string().max(24000),
  ranWithoutError: z.boolean(),
  stdout: z.string(),
  stderr: z.string(),
  errorName: z.string().optional(),
  errorValue: z.string().optional(),
})
export type ExecutionAttempt = z.infer<typeof executionAttemptSchema>
export const executionEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('status'), message: z.string() }),
  z.object({ type: z.literal('attempt'), attempt: executionAttemptSchema }),
  z.object({ type: z.literal('done'), outcome: z.enum(['ran-clean', 'still-failing', 'error']), message: z.string(), attempts: z.number().int().min(0).max(3) }),
])
export type ExecutionEvent = z.infer<typeof executionEventSchema>
export type ExecutionState = { runId: string | null; status: 'idle' | 'running' | 'ran-clean' | 'still-failing' | 'error'; message: string; attempts: ExecutionAttempt[] }
export function initialExecution(): ExecutionState { return { runId: null, status: 'idle', message: '', attempts: [] } }
export function applyExecutionEvent(state: ExecutionState, event: ExecutionEvent): ExecutionState {
  switch (event.type) {
    case 'status': return { ...state, message: event.message }
    case 'attempt': return { ...state, attempts: [...state.attempts.filter(item => item.attempt !== event.attempt.attempt), event.attempt].sort((a, b) => a.attempt - b.attempt) }
    case 'done': return { ...state, status: event.outcome, message: event.message }
  }
}

export const auditEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('phase'), id: z.enum(phaseIds), status: statusSchema, detail: z.string(), durationMs: z.number().optional() }),
  z.object({ type: z.literal('text'), target: z.enum(['draft', 'revision']), text: z.string() }),
  z.object({ type: z.literal('review'), reviewer: z.enum(['claude', 'gemini']), status: z.enum(['completed', 'failed', 'skipped']), review: reviewSchema.optional(), message: z.string(), durationMs: z.number() }),
  z.object({ type: z.literal('sources'), sources: z.array(sourceSchema).max(4) }),
  z.object({ type: z.literal('assessment'), assessment: assessmentSchema }),
  z.object({ type: z.literal('notice'), message: z.string() }),
  z.object({ type: z.literal('done'), outcome: z.enum(['completed', 'partial', 'failed']), durationMs: z.number() }),
])
export type AuditEvent = z.infer<typeof auditEventSchema>
export type ReviewerResult = Extract<AuditEvent, { type: 'review' }>
export type AuditState = {
  runId: string | null; status: 'idle' | 'running' | 'completed' | 'partial' | 'failed' | 'cancelled';
  phases: Record<PhaseId, Phase>; draft: string; revision: string;
  reviews: Partial<Record<'claude' | 'gemini', ReviewerResult>>;
  sources: Source[]; assessment: Assessment | null; notices: string[]; durationMs?: number;
}
export function initialAudit(): AuditState {
  return { runId: null, status: 'idle', phases: Object.fromEntries(phaseIds.map(id => [id, { status: 'pending', detail: 'Waiting to start' }])) as AuditState['phases'], draft: '', revision: '', reviews: {}, sources: [], assessment: null, notices: [] }
}
export function applyAuditEvent(state: AuditState, event: AuditEvent): AuditState {
  switch (event.type) {
    case 'phase': return { ...state, phases: { ...state.phases, [event.id]: { status: event.status, detail: event.detail, durationMs: event.durationMs } } }
    case 'text': return { ...state, [event.target]: state[event.target] + event.text }
    case 'review': return { ...state, reviews: { ...state.reviews, [event.reviewer]: event } }
    case 'sources': return { ...state, sources: event.sources }
    case 'assessment': return { ...state, assessment: event.assessment }
    case 'notice': return { ...state, notices: [...state.notices, event.message] }
    case 'done': return { ...state, status: event.outcome, durationMs: event.durationMs }
  }
}
