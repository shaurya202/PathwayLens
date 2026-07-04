import { ReactomeResult } from '../../shared/types'

const BASE_URL = 'https://reactome.org/ContentService'
const TIMEOUT_MS = 5000

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

const searchCache = new Map<string, Promise<ReactomeResult[]>>()

export async function searchPathways(query: string, maxResults: number = 5): Promise<ReactomeResult[]> {
  const isTest = typeof process !== 'undefined' && process.env.VITEST === 'true'
  const key = `${query.toLowerCase().trim()}_${maxResults}`
  if (!isTest && searchCache.has(key)) {
    return searchCache.get(key)!
  }

  const promise = (async () => {
    const url = `${BASE_URL}/search/query?query=${encodeURIComponent(query)}&types=Pathway&species=Homo+sapiens&cluster=true`

    const response = await fetchWithTimeout(url, {
      headers: { 'Accept': 'application/json' }
    })

    if (!response.ok) {
      throw new Error(`Reactome API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const results = data.results || []

    return results
      .filter((r: any) => r.stId || r.stableIdentifier?.identifier)
      .slice(0, maxResults)
      .map((r: any) => {
        const stableId = r.stId || r.stableIdentifier?.identifier || ''
        const summation = Array.isArray(r.summation) ? r.summation : []
        return {
          stableId,
          pathwayName: r.displayName || r.name || '',
          summation,
          url: `https://reactome.org/content/detail/${stableId}`
        }
      })
  })()

  if (!isTest) {
    searchCache.set(key, promise)
    // Cache for 5 minutes
    setTimeout(() => searchCache.delete(key), 5 * 60 * 1000)
  }

  return promise
}

export async function fetchPathwayDetails(stableId: string): Promise<ReactomeResult | null> {
  const url = `${BASE_URL}/data/pathway/${stableId}`

  const response = await fetchWithTimeout(url, {
    headers: { 'Accept': 'application/json' }
  })

  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(`Reactome API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  return {
    stableId: data.stId || stableId,
    pathwayName: data.displayName || '',
    summation: data.summation || [],
    url: `https://reactome.org/content/detail/${data.stId || stableId}`
  }
}
