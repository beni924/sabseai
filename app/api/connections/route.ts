export const dynamic = 'force-dynamic'

export async function GET() {
  const checks = [
    { id: 'openai', label: 'OpenAI key', key: process.env.OPENAI_API_KEY, url: 'https://api.openai.com/v1/models', header: 'Authorization', bearer: true },
    { id: 'anthropic', label: 'Native Claude engine', key: process.env.ANTHROPIC_API_KEY, url: 'https://api.anthropic.com/v1/models', header: 'x-api-key' },
    { id: 'gemini', label: 'Google Gemini key', key: process.env.GOOGLE_GENERATIVE_AI_API_KEY, url: 'https://generativelanguage.googleapis.com/v1beta/models', header: 'x-goog-api-key' },
    { id: 'tavily', label: 'Tavily web search', key: process.env.TAVILY_API_KEY, url: 'https://api.tavily.com/usage', header: 'Authorization', bearer: true },
    { id: 'pinecone', label: 'Pinecone data', key: process.env.PINECONE_API_KEY, url: 'https://api.pinecone.io/indexes', header: 'Api-Key' },
  ]
  const connections = await Promise.all(checks.map(async ({ id, label, key, url, header, bearer }) => {
    if (!key) return { id, label, status: 'Not configured', detail: 'No server-side credential is available in this runtime.', capability: id === 'openai' ? 'AI Gateway drafts use a separate connection.' : 'Unavailable' }
    try {
      const response = await fetch(url, { headers: { [header]: bearer ? `Bearer ${key}` : key, ...(id === 'pinecone' ? { 'X-Pinecone-Api-Version': '2025-10' } : {}), ...(id === 'anthropic' ? { 'anthropic-version': '2023-06-01' } : {}) }, cache: 'no-store', signal: AbortSignal.timeout(10000) })
      await response.body?.cancel()
      const status = response.ok ? 'Verified' : [401, 403].includes(response.status) ? 'Authorization failed' : response.status === 429 ? 'Usage limit' : 'Check unavailable'
      const detail = response.ok
        ? id === 'pinecone' ? 'Credential verified. Retrieval remains disabled until an index, namespace, text mapping, and embedding compatibility are approved.'
          : id === 'tavily' ? 'Service check passed. Live search availability is checked again during each run.'
            : id === 'openai' ? 'Direct key check passed. Drafts and chat still use AI Gateway, not this key.'
              : 'Credential check passed. Model access, quota, and generation are checked during the audit.'
        : 'The diagnostic request did not succeed. No credential values or raw provider errors are returned. A failed diagnostic does not establish generation capability.'
      return { id, label, status, detail, capability: id === 'pinecone' ? 'Retrieval disabled' : id === 'openai' ? 'Drafts via AI Gateway' : response.ok ? 'Service check passed' : 'Not verified' }
    } catch { return { id, label, status: 'Check unavailable', detail: 'The provider did not respond. You can retry this check.', capability: 'Not verified' } }
  }))
  connections.push({ id: 'openrouter', label: 'OpenRouter alternative models', status: 'Not configured', detail: 'Optional routing is not enabled. It does not block the other providers.', capability: 'Unavailable' })

  const financeKey = process.env.ALPHA_VANTAGE_API_KEY || process.env.FINANCE_MARKET_API_KEY
  connections.push(await (async () => {
    const base = { id: 'finance', label: 'Financial Market API Key', placeholder: 'AV_KEY_…' }
    if (!financeKey) return { ...base, status: 'Not configured', detail: 'No server-side Alpha Vantage credential is available in this runtime. Add ALPHA_VANTAGE_API_KEY in Settings → Vars.', capability: 'Unavailable' }
    try {
      const response = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=IBM&apikey=${financeKey}`, { cache: 'no-store', signal: AbortSignal.timeout(10000) })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) return { ...base, status: 'Check unavailable', detail: 'The diagnostic request did not succeed. No credential values are returned.', capability: 'Not verified' }
      if (body['Error Message'] || body['Information']) return { ...base, status: 'Authorization failed', detail: 'Alpha Vantage rejected the diagnostic (invalid key or quota). No raw provider error is returned.', capability: 'Not verified' }
      if (body['Note']) return { ...base, status: 'Usage limit', detail: 'The free tier request limit was reached. The credential itself appears valid.', capability: 'Rate limited' }
      if (body['Global Quote']) return { ...base, status: 'Verified', detail: 'Credential check passed against a live quote. No market feature consumes it yet.', capability: 'Service check passed' }
      return { ...base, status: 'Check unavailable', detail: 'The response was not recognized. You can retry this check.', capability: 'Not verified' }
    } catch { return { ...base, status: 'Check unavailable', detail: 'Alpha Vantage did not respond. You can retry this check.', capability: 'Not verified' } }
  })())

  const sportsKey = process.env.ODDS_API_KEY || process.env.SPORTS_PREDICTOR_API_KEY
  connections.push(await (async () => {
    const base = { id: 'sports', label: 'Sports Analytics API Key', placeholder: 'ODDS_KEY_…' }
    if (!sportsKey) return { ...base, status: 'Not configured', detail: 'No server-side Odds API credential is available in this runtime. Add ODDS_API_KEY in Settings → Vars.', capability: 'Unavailable' }
    try {
      const response = await fetch(`https://api.the-odds-api.com/v4/sports/?apiKey=${sportsKey}`, { cache: 'no-store', signal: AbortSignal.timeout(10000) })
      const remaining = response.headers.get('x-requests-remaining')
      await response.body?.cancel()
      if (response.ok) return { ...base, status: 'Verified', detail: `Credential check passed against the sports catalog${remaining ? ` (${remaining} requests remaining this period)` : ''}. No sports feature consumes it yet.`, capability: 'Service check passed' }
      if ([401, 403].includes(response.status)) return { ...base, status: 'Authorization failed', detail: 'The Odds API rejected the diagnostic. No credential values or raw provider errors are returned.', capability: 'Not verified' }
      if (response.status === 429) return { ...base, status: 'Usage limit', detail: 'The request quota for this period was reached. The credential itself appears valid.', capability: 'Rate limited' }
      return { ...base, status: 'Check unavailable', detail: 'The diagnostic request did not succeed. You can retry this check.', capability: 'Not verified' }
    } catch { return { ...base, status: 'Check unavailable', detail: 'The Odds API did not respond. You can retry this check.', capability: 'Not verified' } }
  })())

  return Response.json({ connections }, { headers: { 'Cache-Control': 'no-store' } })
}
