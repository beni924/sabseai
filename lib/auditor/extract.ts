// Shared by the client (to detect runnable code) and the server (to read Claude's correction).
export function extractPython(markdown: string): string | null {
  const fenced = markdown.match(/```(?:python|py)[^\n]*\n([\s\S]*?)```/i)
  const code = fenced?.[1]?.trim()
  return code ? code : null
}

// Claude is told to return a ```python block, but fall back to any fence, then raw text.
export function extractCorrection(text: string): string | null {
  return extractPython(text) || text.match(/```[^\n]*\n([\s\S]*?)```/)?.[1]?.trim() || text.trim() || null
}
