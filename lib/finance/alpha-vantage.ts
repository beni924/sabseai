import { z } from 'zod'

export interface PriceDataPoint {
  date: string
  open: string
  high: string
  low: string
  close: string
  volume: string
}

export interface PriceActionSummary {
  status: 'available' | 'unavailable'
  errorMessage?: string
  latestDate?: string
  latestClose?: string
  previousClose?: string
  change?: string
  changePercent?: string
  latestVolume?: string
  weeklyHistory?: PriceDataPoint[]
}

export interface OverviewMetrics {
  status: 'available' | 'unavailable'
  errorMessage?: string
  symbol?: string
  assetType?: string
  name?: string
  description?: string
  exchange?: string
  currency?: string
  country?: string
  sector?: string
  industry?: string
  marketCap?: string
  peRatio?: string
  pegRatio?: string
  bookValue?: string
  dividendYield?: string
  eps?: string
  revenueTTM?: string
  profitMargin?: string
  operatingMarginTTM?: string
  returnOnAssetsTTM?: string
  returnOnEquityTTM?: string
  high52Week?: string
  low52Week?: string
  movingAverage50Day?: string
  movingAverage200Day?: string
  quarterlyEarningsGrowthYOY?: string
  quarterlyRevenueGrowthYOY?: string
}

export interface IncomeStatementQuarter {
  fiscalDateEnding: string
  totalRevenue: string
  costOfRevenue: string
  grossProfit: string
  operatingIncome: string
  netIncome: string
  ebitda: string
}

export interface BalanceSheetQuarter {
  fiscalDateEnding: string
  totalAssets: string
  totalLiabilities: string
  cashAndCashEquivalents: string
  shortTermInvestments: string
  totalCurrentAssets: string
  totalCurrentLiabilities: string
  totalDebt: string
  totalShareholderEquity: string
}

export interface FinancialStatements {
  status: 'available' | 'unavailable'
  errorMessage?: string
  incomeQuarterly?: IncomeStatementQuarter[]
  balanceQuarterly?: BalanceSheetQuarter[]
}

export interface NewsArticle {
  title: string
  url: string
  timePublished: string
  authors: string[]
  summary: string
  source: string
  overallSentimentScore: number
  overallSentimentLabel: string
  tickerSentimentScore?: string
  tickerSentimentLabel?: string
}

export interface NewsSentimentData {
  status: 'available' | 'unavailable'
  errorMessage?: string
  articles?: NewsArticle[]
}

export interface StructuredFinanceData {
  ticker: string
  fetchedAt: string
  cached: boolean
  priceAction: PriceActionSummary
  overview: OverviewMetrics
  financials: FinancialStatements
  newsSentiment: NewsSentimentData
}

// In-memory cache to respect Alpha Vantage rate limits (5-10 min TTL)
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes
const financeCache = new Map<string, { timestamp: number; data: StructuredFinanceData }>()

function getApiKey(): string {
  const key = process.env.ALPHA_VANTAGE_API_KEY || process.env.API_KEY
  if (!key) {
    throw new Error('ALPHA_VANTAGE_API_KEY is not configured in environment variables.')
  }
  return key
}

function parseFormattedDate(dateStr: string): string {
  if (!dateStr) return 'N/A'
  if (dateStr.length === 8 && /^\d{8}$/.test(dateStr)) {
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
  }
  return dateStr
}

function parseFormattedTime(timeStr: string): string {
  if (!timeStr) return 'N/A'
  if (timeStr.length >= 15) {
    // Format YYYYMMDDTHMMSS -> YYYY-MM-DD HH:MM
    const date = parseFormattedDate(timeStr.slice(0, 8))
    const time = `${timeStr.slice(9, 11)}:${timeStr.slice(11, 13)}`
    return `${date} ${time} UTC`
  }
  return timeStr
}

export function extractTickerSymbol(inputStr: string): string | null {
  const clean = inputStr.trim().toUpperCase()
  // Check explicit $TICKER or standalone uppercase 1-5 letter ticker
  const match = clean.match(/\$([A-Z]{1,5})\b/) || clean.match(/\b([A-Z]{1,5})\b/)
  if (!match) return null
  // Exclude common English words that look like tickers
  const excluded = new Set(['THE', 'AND', 'FOR', 'BUY', 'SELL', 'NEWS', 'DATA', 'STOCK', 'WHAT', 'WITH', 'DATE', 'MORE', 'FROM', 'INFO'])
  const ticker = match[1]
  if (excluded.has(ticker)) {
    const secondMatch = clean.match(/\$([A-Z]{1,5})\b/)
    return secondMatch ? secondMatch[1] : null
  }
  return ticker
}

/**
 * Endpoint 1: TIME_SERIES_DAILY
 * Fetches recent daily price history and calculates price action metrics.
 */
async function fetchPriceAction(ticker: string, apiKey: string): Promise<PriceActionSummary> {
  try {
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(ticker)}&apikey=${apiKey}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      return { status: 'unavailable', errorMessage: `HTTP ${res.status}: Failed to reach Alpha Vantage TIME_SERIES_DAILY` }
    }
    const json = await res.json()
    if (json['Note'] || json['Information']) {
      return { status: 'unavailable', errorMessage: json['Note'] || json['Information'] || 'Alpha Vantage rate limit reached' }
    }
    if (json['Error Message']) {
      return { status: 'unavailable', errorMessage: `Invalid ticker or ticker not found: ${ticker}` }
    }
    const timeSeries = json['Time Series (Daily)']
    if (!timeSeries || typeof timeSeries !== 'object') {
      return { status: 'unavailable', errorMessage: 'Price time-series data missing for ticker' }
    }

    const dates = Object.keys(timeSeries).sort().reverse() // Most recent first
    if (dates.length === 0) {
      return { status: 'unavailable', errorMessage: 'No price history entries returned' }
    }

    const latestDate = dates[0]
    const prevDate = dates[1]
    const latestBar = timeSeries[latestDate]
    const prevBar = prevDate ? timeSeries[prevDate] : null

    const latestClose = parseFloat(latestBar['4. close'])
    const prevClose = prevBar ? parseFloat(prevBar['4. close']) : latestClose
    const diff = latestClose - prevClose
    const diffPercent = prevClose !== 0 ? (diff / prevClose) * 100 : 0

    const weeklyHistory: PriceDataPoint[] = dates.slice(0, 5).map(date => ({
      date,
      open: timeSeries[date]['1. open'],
      high: timeSeries[date]['2. high'],
      low: timeSeries[date]['3. low'],
      close: timeSeries[date]['4. close'],
      volume: timeSeries[date]['5. volume'],
    }))

    return {
      status: 'available',
      latestDate,
      latestClose: `$${latestClose.toFixed(2)}`,
      previousClose: `$${prevClose.toFixed(2)}`,
      change: `${diff >= 0 ? '+' : ''}$${diff.toFixed(2)}`,
      changePercent: `${diffPercent >= 0 ? '+' : ''}${diffPercent.toFixed(2)}%`,
      latestVolume: parseInt(latestBar['5. volume']).toLocaleString(),
      weeklyHistory,
    }
  } catch (err) {
    return { status: 'unavailable', errorMessage: err instanceof Error ? err.message : 'Unknown price fetch error' }
  }
}

/**
 * Endpoint 2a: OVERVIEW
 * Fetches overview metrics, valuation ratios, sector, and 52-week statistics.
 */
async function fetchOverview(ticker: string, apiKey: string): Promise<OverviewMetrics> {
  try {
    const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${encodeURIComponent(ticker)}&apikey=${apiKey}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      return { status: 'unavailable', errorMessage: `HTTP ${res.status}: Failed OVERVIEW fetch` }
    }
    const json = await res.json()
    if (json['Note'] || json['Information']) {
      return { status: 'unavailable', errorMessage: json['Note'] || json['Information'] }
    }
    if (!json.Symbol || Object.keys(json).length === 0) {
      return { status: 'unavailable', errorMessage: `No OVERVIEW data found for ticker ${ticker}` }
    }

    return {
      status: 'available',
      symbol: json.Symbol,
      assetType: json.AssetType,
      name: json.Name,
      description: json.Description,
      exchange: json.Exchange,
      currency: json.Currency,
      country: json.Country,
      sector: json.Sector,
      industry: json.Industry,
      marketCap: json.MarketCapitalization ? `$${(parseFloat(json.MarketCapitalization) / 1e9).toFixed(2)}B` : 'N/A',
      peRatio: json.PERatio || 'N/A',
      pegRatio: json.PEGRatio || 'N/A',
      bookValue: json.BookValue ? `$${json.BookValue}` : 'N/A',
      dividendYield: json.DividendYield ? `${(parseFloat(json.DividendYield) * 100).toFixed(2)}%` : 'N/A',
      eps: json.EPS ? `$${json.EPS}` : 'N/A',
      revenueTTM: json.RevenueTTM ? `$${(parseFloat(json.RevenueTTM) / 1e9).toFixed(2)}B` : 'N/A',
      profitMargin: json.ProfitMargin ? `${(parseFloat(json.ProfitMargin) * 100).toFixed(2)}%` : 'N/A',
      operatingMarginTTM: json.OperatingMarginTTM ? `${(parseFloat(json.OperatingMarginTTM) * 100).toFixed(2)}%` : 'N/A',
      returnOnAssetsTTM: json.ReturnOnAssetsTTM ? `${(parseFloat(json.ReturnOnAssetsTTM) * 100).toFixed(2)}%` : 'N/A',
      returnOnEquityTTM: json.ReturnOnEquityTTM ? `${(parseFloat(json.ReturnOnEquityTTM) * 100).toFixed(2)}%` : 'N/A',
      high52Week: json['52WeekHigh'] ? `$${json['52WeekHigh']}` : 'N/A',
      low52Week: json['52WeekLow'] ? `$${json['52WeekLow']}` : 'N/A',
      movingAverage50Day: json['50DayMovingAverage'] ? `$${json['50DayMovingAverage']}` : 'N/A',
      movingAverage200Day: json['200DayMovingAverage'] ? `$${json['200DayMovingAverage']}` : 'N/A',
      quarterlyEarningsGrowthYOY: json.QuarterlyEarningsGrowthYOY ? `${(parseFloat(json.QuarterlyEarningsGrowthYOY) * 100).toFixed(2)}%` : 'N/A',
      quarterlyRevenueGrowthYOY: json.QuarterlyRevenueGrowthYOY ? `${(parseFloat(json.QuarterlyRevenueGrowthYOY) * 100).toFixed(2)}%` : 'N/A',
    }
  } catch (err) {
    return { status: 'unavailable', errorMessage: err instanceof Error ? err.message : 'Unknown OVERVIEW error' }
  }
}

/**
 * Endpoint 2b & 2c: INCOME_STATEMENT & BALANCE_SHEET
 * Fetches quarterly financial statements for revenue, profit, cash, and debt balance.
 */
async function fetchFinancialStatements(ticker: string, apiKey: string): Promise<FinancialStatements> {
  try {
    const incUrl = `https://www.alphavantage.co/query?function=INCOME_STATEMENT&symbol=${encodeURIComponent(ticker)}&apikey=${apiKey}`
    const balUrl = `https://www.alphavantage.co/query?function=BALANCE_SHEET&symbol=${encodeURIComponent(ticker)}&apikey=${apiKey}`

    const [incRes, balRes] = await Promise.all([
      fetch(incUrl, { cache: 'no-store' }),
      fetch(balUrl, { cache: 'no-store' }),
    ])

    let incomeQuarterly: IncomeStatementQuarter[] = []
    let balanceQuarterly: BalanceSheetQuarter[] = []

    if (incRes.ok) {
      const incJson = await incRes.json()
      if (Array.isArray(incJson.quarterlyReports)) {
        incomeQuarterly = incJson.quarterlyReports.slice(0, 4).map((q: any) => ({
          fiscalDateEnding: q.fiscalDateEnding || 'N/A',
          totalRevenue: q.totalRevenue ? `$${(parseFloat(q.totalRevenue) / 1e9).toFixed(2)}B` : 'N/A',
          costOfRevenue: q.costOfRevenue ? `$${(parseFloat(q.costOfRevenue) / 1e9).toFixed(2)}B` : 'N/A',
          grossProfit: q.grossProfit ? `$${(parseFloat(q.grossProfit) / 1e9).toFixed(2)}B` : 'N/A',
          operatingIncome: q.operatingIncome ? `$${(parseFloat(q.operatingIncome) / 1e9).toFixed(2)}B` : 'N/A',
          netIncome: q.netIncome ? `$${(parseFloat(q.netIncome) / 1e9).toFixed(2)}B` : 'N/A',
          ebitda: q.ebitda ? `$${(parseFloat(q.ebitda) / 1e9).toFixed(2)}B` : 'N/A',
        }))
      }
    }

    if (balRes.ok) {
      const balJson = await balRes.json()
      if (Array.isArray(balJson.quarterlyReports)) {
        balanceQuarterly = balJson.quarterlyReports.slice(0, 4).map((q: any) => ({
          fiscalDateEnding: q.fiscalDateEnding || 'N/A',
          totalAssets: q.totalAssets ? `$${(parseFloat(q.totalAssets) / 1e9).toFixed(2)}B` : 'N/A',
          totalLiabilities: q.totalLiabilities ? `$${(parseFloat(q.totalLiabilities) / 1e9).toFixed(2)}B` : 'N/A',
          cashAndCashEquivalents: q.cashAndCashEquivalents ? `$${(parseFloat(q.cashAndCashEquivalents) / 1e9).toFixed(2)}B` : 'N/A',
          shortTermInvestments: q.shortTermInvestments ? `$${(parseFloat(q.shortTermInvestments) / 1e9).toFixed(2)}B` : 'N/A',
          totalCurrentAssets: q.totalCurrentAssets ? `$${(parseFloat(q.totalCurrentAssets) / 1e9).toFixed(2)}B` : 'N/A',
          totalCurrentLiabilities: q.totalCurrentLiabilities ? `$${(parseFloat(q.totalCurrentLiabilities) / 1e9).toFixed(2)}B` : 'N/A',
          totalDebt: q.shortLongTermDebtTotal ? `$${(parseFloat(q.shortLongTermDebtTotal) / 1e9).toFixed(2)}B` : 'N/A',
          totalShareholderEquity: q.totalShareholderEquity ? `$${(parseFloat(q.totalShareholderEquity) / 1e9).toFixed(2)}B` : 'N/A',
        }))
      }
    }

    if (incomeQuarterly.length === 0 && balanceQuarterly.length === 0) {
      return { status: 'unavailable', errorMessage: 'Financial statements not available for ticker' }
    }

    return {
      status: 'available',
      incomeQuarterly,
      balanceQuarterly,
    }
  } catch (err) {
    return { status: 'unavailable', errorMessage: err instanceof Error ? err.message : 'Financial statements fetch error' }
  }
}

/**
 * Endpoint 3: NEWS_SENTIMENT
 * Fetches recent news articles, sentiment scores, and publication dates tied to ticker.
 */
async function fetchNewsSentiment(ticker: string, apiKey: string): Promise<NewsSentimentData> {
  try {
    const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${encodeURIComponent(ticker)}&limit=8&sort=LATEST&apikey=${apiKey}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      return { status: 'unavailable', errorMessage: `HTTP ${res.status}: NEWS_SENTIMENT endpoint failed` }
    }
    const json = await res.json()
    if (json['Note'] || json['Information']) {
      return { status: 'unavailable', errorMessage: json['Note'] || json['Information'] }
    }
    if (!Array.isArray(json.feed) || json.feed.length === 0) {
      return { status: 'unavailable', errorMessage: `No news/sentiment coverage returned for ticker ${ticker}` }
    }

    const articles: NewsArticle[] = json.feed.slice(0, 6).map((item: any) => {
      const tickerSentiment = Array.isArray(item.ticker_sentiment)
        ? item.ticker_sentiment.find((ts: any) => ts.ticker?.toUpperCase() === ticker.toUpperCase())
        : null

      return {
        title: item.title || 'Untitled Article',
        url: item.url || '',
        timePublished: parseFormattedTime(item.time_published),
        authors: Array.isArray(item.authors) ? item.authors : [],
        summary: item.summary ? item.summary.slice(0, 300) : '',
        source: item.source || 'News Outlet',
        overallSentimentScore: typeof item.overall_sentiment_score === 'number' ? item.overall_sentiment_score : parseFloat(item.overall_sentiment_score || '0'),
        overallSentimentLabel: item.overall_sentiment_label || 'Neutral',
        tickerSentimentScore: tickerSentiment?.ticker_sentiment_score || undefined,
        tickerSentimentLabel: tickerSentiment?.ticker_sentiment_label || undefined,
      }
    })

    return {
      status: 'available',
      articles,
    }
  } catch (err) {
    return { status: 'unavailable', errorMessage: err instanceof Error ? err.message : 'NEWS_SENTIMENT fetch error' }
  }
}

/**
 * Main Data Fetcher with Rate-Limit Awareness & Caching
 */
export async function getStructuredFinanceData(symbol: string): Promise<StructuredFinanceData> {
  const ticker = symbol.toUpperCase().trim()
  const apiKey = getApiKey()

  // 1. Check in-memory cache
  const cached = financeCache.get(ticker)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return { ...cached.data, cached: true }
  }

  // 2. Fetch all 3 data types in parallel
  const [priceAction, overview, financials, newsSentiment] = await Promise.all([
    fetchPriceAction(ticker, apiKey),
    fetchOverview(ticker, apiKey),
    fetchFinancialStatements(ticker, apiKey),
    fetchNewsSentiment(ticker, apiKey),
  ])

  const result: StructuredFinanceData = {
    ticker,
    fetchedAt: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
    cached: false,
    priceAction,
    overview,
    financials,
    newsSentiment,
  }

  // Save to cache
  financeCache.set(ticker, { timestamp: Date.now(), data: result })

  return result
}

/**
 * Serializes the structured data into clear, labeled text for the LLM System Prompt.
 */
export function formatFinanceDataForSystemPrompt(data: StructuredFinanceData): string {
  const lines: string[] = []

  lines.push(`=== ALPHA VANTAGE STRUCTURED MARKET DATA FOR TICKER: ${data.ticker} ===`)
  lines.push(`FETCH_DATE_TIME: ${data.fetchedAt}`)
  lines.push(`CACHE_STATUS: ${data.cached ? 'Serving cached data to enforce rate-limit discipline' : 'Live Alpha Vantage API response'}`)
  lines.push('')

  // 1. Price Action
  lines.push(`--- SECTION 1: PRICE ACTION (Source: Alpha Vantage TIME_SERIES_DAILY) ---`)
  if (data.priceAction.status === 'unavailable') {
    lines.push(`STATUS: SECTION UNAVAILABLE`)
    lines.push(`REASON: ${data.priceAction.errorMessage || 'Data unavailable'}`)
  } else {
    lines.push(`latest_trading_date: ${data.priceAction.latestDate}`)
    lines.push(`latest_close_price: ${data.priceAction.latestClose}`)
    lines.push(`previous_close_price: ${data.priceAction.previousClose}`)
    lines.push(`price_change_amount: ${data.priceAction.change}`)
    lines.push(`price_change_percentage: ${data.priceAction.changePercent}`)
    lines.push(`latest_trading_volume: ${data.priceAction.latestVolume}`)
    lines.push(`5_day_price_history:`)
    data.priceAction.weeklyHistory?.forEach(bar => {
      lines.push(`  - date: ${bar.date} | open: $${parseFloat(bar.open).toFixed(2)} | high: $${parseFloat(bar.high).toFixed(2)} | low: $${parseFloat(bar.low).toFixed(2)} | close: $${parseFloat(bar.close).toFixed(2)} | volume: ${parseInt(bar.volume).toLocaleString()}`)
    })
  }
  lines.push('')

  // 2. Overview & Fundamentals
  lines.push(`--- SECTION 2: FUNDAMENTALS & VALUATION (Source: Alpha Vantage OVERVIEW, INCOME_STATEMENT, BALANCE_SHEET) ---`)
  if (data.overview.status === 'unavailable') {
    lines.push(`OVERVIEW_STATUS: SECTION UNAVAILABLE (${data.overview.errorMessage || 'Overview missing'})`)
  } else {
    const o = data.overview
    lines.push(`company_name: ${o.name || data.ticker}`)
    lines.push(`sector: ${o.sector || 'N/A'} | industry: ${o.industry || 'N/A'}`)
    lines.push(`market_capitalization: ${o.marketCap}`)
    lines.push(`pe_ratio_ttm: ${o.peRatio}`)
    lines.push(`peg_ratio: ${o.pegRatio}`)
    lines.push(`eps_ttm: ${o.eps}`)
    lines.push(`revenue_ttm: ${o.revenueTTM}`)
    lines.push(`profit_margin: ${o.profitMargin}`)
    lines.push(`operating_margin_ttm: ${o.operatingMarginTTM}`)
    lines.push(`return_on_assets_ttm: ${o.returnOnAssetsTTM}`)
    lines.push(`return_on_equity_ttm: ${o.returnOnEquityTTM}`)
    lines.push(`dividend_yield: ${o.dividendYield}`)
    lines.push(`52_week_high: ${o.high52Week}`)
    lines.push(`52_week_low: ${o.low52Week}`)
    lines.push(`50_day_moving_average: ${o.movingAverage50Day}`)
    lines.push(`200_day_moving_average: ${o.movingAverage200Day}`)
    lines.push(`quarterly_revenue_growth_yoy: ${o.quarterlyRevenueGrowthYOY}`)
  }

  lines.push('')
  lines.push(`QUARTERLY_INCOME_STATEMENTS (Income Statement Filings):`)
  if (data.financials.status === 'unavailable' || !data.financials.incomeQuarterly?.length) {
    lines.push(`INCOME_STATEMENT_STATUS: SECTION UNAVAILABLE (${data.financials.errorMessage || 'No filing data'})`)
  } else {
    data.financials.incomeQuarterly.forEach((q, idx) => {
      lines.push(`  - quarter_${idx + 1}_ending_date: ${q.fiscalDateEnding} | total_revenue: ${q.totalRevenue} | gross_profit: ${q.grossProfit} | operating_income: ${q.operatingIncome} | net_income: ${q.netIncome}`)
    })
  }

  lines.push('')
  lines.push(`QUARTERLY_BALANCE_SHEETS (Balance Sheet Filings):`)
  if (data.financials.status === 'unavailable' || !data.financials.balanceQuarterly?.length) {
    lines.push(`BALANCE_SHEET_STATUS: SECTION UNAVAILABLE`)
  } else {
    data.financials.balanceQuarterly.forEach((q, idx) => {
      lines.push(`  - quarter_${idx + 1}_ending_date: ${q.fiscalDateEnding} | total_assets: ${q.totalAssets} | total_liabilities: ${q.totalLiabilities} | cash_and_equivalents: ${q.cashAndCashEquivalents} | total_debt: ${q.totalDebt} | shareholder_equity: ${q.totalShareholderEquity}`)
    })
  }
  lines.push('')

  // 3. News & Sentiment
  lines.push(`--- SECTION 3: NEWS & SENTIMENT (Source: Alpha Vantage NEWS_SENTIMENT) ---`)
  if (data.newsSentiment.status === 'unavailable' || !data.newsSentiment.articles?.length) {
    lines.push(`NEWS_STATUS: SECTION UNAVAILABLE`)
    lines.push(`REASON: ${data.newsSentiment.errorMessage || 'No recent coverage'}`)
  } else {
    data.newsSentiment.articles.forEach((art, idx) => {
      lines.push(`  - article_${idx + 1}:`)
      lines.push(`      headline: "${art.title}"`)
      lines.push(`      publication_date: ${art.timePublished}`)
      lines.push(`      source_outlet: "${art.source}"`)
      lines.push(`      sentiment_label: ${art.overallSentimentLabel} (score: ${art.overallSentimentScore.toFixed(2)})`)
      lines.push(`      ticker_specific_sentiment: ${art.tickerSentimentLabel || art.overallSentimentLabel} (${art.tickerSentimentScore || art.overallSentimentScore.toFixed(2)})`)
      lines.push(`      source_url: ${art.url}`)
      lines.push(`      summary_snippet: "${art.summary.replace(/"/g, "'")}"`)
    })
  }

  return lines.join('\n')
}
