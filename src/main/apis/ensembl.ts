import { EnsemblResult } from '../../shared/types'

const BASE_URL = 'https://rest.ensembl.org'
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

const lookupCache = new Map<string, Promise<EnsemblResult | null>>()

export async function lookupGene(symbol: string): Promise<EnsemblResult | null> {
  const isTest = typeof process !== 'undefined' && process.env.VITEST === 'true'
  const key = symbol.toLowerCase().trim()
  if (!isTest && lookupCache.has(key)) {
    return lookupCache.get(key)!
  }

  const promise = (async () => {
    const url = `${BASE_URL}/lookup/symbol/homo_sapiens/${symbol}?expand=0`

    const response = await fetchWithTimeout(url, {
      headers: { 'Content-Type': 'application/json' }
    })

    if (response.status === 404) return null
    if (!response.ok) {
      throw new Error(`Ensembl API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return parseEnsemblGene(data)
  })()

  if (!isTest) {
    lookupCache.set(key, promise)
    // Cache for 5 minutes
    setTimeout(() => lookupCache.delete(key), 5 * 60 * 1000)
  }

  return promise
}

export async function searchGenes(query: string): Promise<EnsemblResult[]> {
  const url = `${BASE_URL}/lookup/symbol/homo_sapiens/${query}?expand=0`

  const response = await fetchWithTimeout(url, {
    headers: { 'Content-Type': 'application/json' }
  })

  if (response.status === 404) return []
  if (!response.ok) {
    throw new Error(`Ensembl API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  const gene = parseEnsemblGene(data)
  return gene ? [gene] : []
}

function parseEnsemblGene(data: any): EnsemblResult {
  return {
    id: data.id || '',
    displayName: data.display_name || '',
    description: data.description || '',
    biotype: data.biotype || '',
    xrefs: (data.xrefs || []).map((x: any) => ({
      database: x.database || '',
      identifier: x.primary_id || x.display_id || ''
    }))
  }
}
