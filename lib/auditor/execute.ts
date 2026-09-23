import 'server-only'

import { Sandbox } from '@e2b/code-interpreter'
import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { safeProviderError } from './pipeline'
import { extractCorrection } from './extract'
import type { ExecutionEvent } from './types'

const MAX_ATTEMPTS = 3
const PER_ATTEMPT_TIMEOUT_MS = 30000
const SANDBOX_LIFETIME_MS = 150000

// Redact any long env value that could otherwise surface in sandbox output or a traceback.
function sanitize(text: string): string {
  const secrets = Object.values(process.env).filter((value): value is string => Boolean(value && value.length > 8))
  const redacted = secrets.reduce((message, secret) => message.split(secret).join('[redacted]'), text)
  return redacted.length > 6000 ? `${redacted.slice(0, 6000)}\n…output truncated…` : redacted
}

async function correct(code: string, error: { name: string; value: string; traceback: string } | undefined, stderr: string, signal: AbortSignal): Promise<string | null> {
  const result = await generateText({
    model: anthropic('claude-fable-5-1'),
    system: 'You repair a single Python script that raised a runtime error. Return ONLY the complete corrected script inside one ```python code block, with no commentary. Preserve the original intent and inputs. Never claim the result is tested, verified, or correct — you are only removing the reported runtime error.',
    prompt: JSON.stringify({ code, error: error ? { name: error.name, value: error.value, traceback: sanitize(error.traceback) } : undefined, stderr }),
    maxOutputTokens: 2500, maxRetries: 0, abortSignal: AbortSignal.any([signal, AbortSignal.timeout(45000)]),
  })
  return extractCorrection(result.text)
}

export async function runExecution({ code, signal, emit }: { code: string; signal: AbortSignal; emit: (event: ExecutionEvent) => void }) {
  if (!process.env.E2B_API_KEY) {
    emit({ type: 'done', outcome: 'error', message: 'Sandbox execution is not configured in this runtime, so nothing was run.', attempts: 0 })
    return
  }
  let sandbox: Sandbox | null = null
  let current = code
  let attemptsRun = 0
  try {
    signal.throwIfAborted()
    emit({ type: 'status', message: 'Starting an isolated sandbox…' })
    sandbox = await Sandbox.create({ apiKey: process.env.E2B_API_KEY, timeoutMs: SANDBOX_LIFETIME_MS })
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      signal.throwIfAborted()
      attemptsRun = attempt
      emit({ type: 'status', message: `Running attempt ${attempt} of ${MAX_ATTEMPTS} in the sandbox…` })
      const execution = await sandbox.runCode(current, { language: 'python', timeoutMs: PER_ATTEMPT_TIMEOUT_MS })
      const stdout = sanitize(execution.logs.stdout.join(''))
      const stderr = sanitize(execution.logs.stderr.join(''))
      const error = execution.error
      const ranWithoutError = !error
      emit({ type: 'attempt', attempt: { attempt, code: current, ranWithoutError, stdout, stderr, errorName: error?.name, errorValue: error ? sanitize(error.value) : undefined } })
      if (ranWithoutError) {
        emit({ type: 'done', outcome: 'ran-clean', message: 'The script ran without raising a runtime error. This is not a guarantee of correctness — validate the output against real tests before relying on it.', attempts: attempt })
        return
      }
      if (attempt === MAX_ATTEMPTS) {
        emit({ type: 'done', outcome: 'still-failing', message: `Still raising ${error?.name || 'an error'} after ${MAX_ATTEMPTS} attempts. No further automatic repair was made.`, attempts: attempt })
        return
      }
      if (!process.env.ANTHROPIC_API_KEY) {
        emit({ type: 'done', outcome: 'still-failing', message: 'The script raised an error and no correction credential is available to attempt a repair.', attempts: attempt })
        return
      }
      emit({ type: 'status', message: `Attempt ${attempt} raised ${error?.name || 'an error'}. Asking Claude for a correction…` })
      try {
        const fixed = await correct(current, error, stderr, signal)
        if (!fixed || fixed === current) {
          emit({ type: 'done', outcome: 'still-failing', message: 'No usable correction was produced, so the script was not changed further.', attempts: attempt })
          return
        }
        current = fixed
      } catch (error) {
        signal.throwIfAborted()
        emit({ type: 'done', outcome: 'error', message: `Correction step failed. ${safeProviderError(error)}`, attempts: attempt })
        return
      }
    }
  } catch (error) {
    const message = signal.aborted ? 'Execution was cancelled before it finished.'
      : error instanceof Error && (error.name === 'AuthenticationError' || /unauthorized|api key/i.test(error.message)) ? 'The sandbox rejected its credential. Set a valid E2B API key (it must start with "e2b_") to enable Run & Repair.'
      : safeProviderError(error)
    emit({ type: 'done', outcome: 'error', message, attempts: attemptsRun })
  } finally {
    await sandbox?.kill().catch(() => {})
  }
}
