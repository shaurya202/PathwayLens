import { UniProtResult } from '../../shared/types'

const BASE_URL = 'https://rest.uniprot.org'
const TIMEOUT_MS = 5000

async function fetchWithTimeout(url: string, timeoutMs: number = TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

const proteinSearchCache = new Map<string, Promise<UniProtResult[]>>()

export async function searchProteins(query: string, maxResults: number = 3): Promise<UniProtResult[]> {
  const isTest = typeof process !== 'undefined' && process.env.VITEST === 'true'
  const key = `${query.toLowerCase().trim()}_${maxResults}`
  if (!isTest && proteinSearchCache.has(key)) {
    return proteinSearchCache.get(key)!
  }

  const promise = (async () => {
    const searchQuery = `${query}+AND+organism_id:9606`
    const url = `${BASE_URL}/uniprotkb/search?query=${encodeURIComponent(searchQuery)}&size=${maxResults}&format=json`

    const response = await fetchWithTimeout(url)
    if (!response.ok) {
      throw new Error(`UniProt API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return (data.results || []).map(parseUniProtEntry)
  })()

  if (!isTest) {
    proteinSearchCache.set(key, promise)
    // Cache for 5 minutes
    setTimeout(() => proteinSearchCache.delete(key), 5 * 60 * 1000)
  }

  return promise
}

export async function fetchProteinDetails(accession: string): Promise<UniProtResult> {
  const url = `${BASE_URL}/uniprotkb/${accession}.json`

  const response = await fetchWithTimeout(url)
  if (!response.ok) {
    throw new Error(`UniProt API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  return parseUniProtEntry(data)
}

function parseUniProtEntry(entry: any): UniProtResult {
  const name = entry.proteins?.[0]?.proteinDescription?.recommendedName?.fullName?.value
    || entry.proteins?.[0]?.proteinDescription?.submissionNames?.[0]?.fullName?.value
    || 'Unknown protein'

  const organism = entry.organism?.scientificName || 'Unknown'

  const functionComments = entry.comments?.filter((c: any) => c.commentType === 'FUNCTION') || []
  const functionText = functionComments.map((c: any) => c.texts?.[0]?.value).filter(Boolean).join(' ')

  const locationComments = entry.comments?.filter((c: any) => c.commentType === 'SUBCELLULAR LOCATION') || []
  const locationText = locationComments.map((c: any) => c.texts?.[0]?.value).filter(Boolean).join(' ')

  const pathwayComments = entry.comments?.filter((c: any) => c.commentType === 'PATHWAY') || []
  const pathways = pathwayComments.map((c: any) => c.texts?.[0]?.value).filter(Boolean)

  return {
    accession: entry.primaryAccession || entry.accession || '',
    name,
    organism,
    function: functionText || 'No function description available',
    subcellularLocation: locationText || 'Unknown',
    pathways
  }
}
