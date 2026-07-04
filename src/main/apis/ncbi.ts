import { NCBIResult } from '../../shared/types'

const BASE_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'
const API_KEY = process.env.NCBI_API_KEY
const TIMEOUT_MS = 5000

function getApiKeyParam(): string {
  return API_KEY ? `&api_key=${API_KEY}` : ''
}

async function fetchWithTimeout(url: string, timeoutMs: number = TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export async function searchGenes(query: string): Promise<string[]> {
  const url = `${BASE_URL}/esearch.fcgi?db=gene&term=${encodeURIComponent(query)}&retmode=json${getApiKeyParam()}`
  const response = await fetchWithTimeout(url)
  if (!response.ok) {
    throw new Error(`NCBI API error: ${response.status} ${response.statusText}`)
  }
  const data = await response.json()
  return data.esearchresult?.idlist || []
}

export async function searchDiseases(query: string): Promise<string[]> {
  const url = `${BASE_URL}/esearch.fcgi?db=mesh&term=${encodeURIComponent(query)}[MH]+OR+${encodeURIComponent(query)}&retmode=json&retmax=10${getApiKeyParam()}`
  const response = await fetchWithTimeout(url)
  if (!response.ok) {
    throw new Error(`NCBI API error: ${response.status} ${response.statusText}`)
  }
  const data = await response.json()
  return data.esearchresult?.idlist || []
}

const pubmedSearchCache = new Map<string, Promise<NCBIResult[]>>()

export async function searchPubmed(query: string, maxResults: number = 5): Promise<NCBIResult[]> {
  const key = `${query.toLowerCase().trim()}_${maxResults}`
  if (pubmedSearchCache.has(key)) {
    return pubmedSearchCache.get(key)!
  }

  const promise = (async () => {
    const searchUrl = `${BASE_URL}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmode=json&retmax=${maxResults}${getApiKeyParam()}`

    const searchResponse = await fetchWithTimeout(searchUrl)
    if (!searchResponse.ok) {
      throw new Error(`NCBI API error: ${searchResponse.status} ${searchResponse.statusText}`)
    }

    const searchData = await searchResponse.json()
    const ids = searchData.esearchresult?.idlist || []

    if (ids.length === 0) return []

    const fetchUrl = `${BASE_URL}/efetch.fcgi?db=pubmed&id=${ids.join(',')}&rettype=xml${getApiKeyParam()}`
    const fetchResponse = await fetchWithTimeout(fetchUrl)
    if (!fetchResponse.ok) {
      throw new Error(`NCBI API error: ${fetchResponse.status} ${fetchResponse.statusText}`)
    }

    const xmlText = await fetchResponse.text()
    return parsePubMedXML(xmlText)
  })()

  pubmedSearchCache.set(key, promise)
  // Cache for 5 minutes
  setTimeout(() => pubmedSearchCache.delete(key), 5 * 60 * 1000)

  return promise
}

// Keep backward compat alias
export const searchAbstracts = searchPubmed

export async function fetchGeneDetails(ids: string[]): Promise<any[]> {
  if (ids.length === 0) return []

  const url = `${BASE_URL}/esummary.fcgi?db=gene&id=${ids.join(',')}&retmode=json${getApiKeyParam()}`
  const response = await fetchWithTimeout(url)
  if (!response.ok) {
    throw new Error(`NCBI API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  return ids.map(id => {
    const doc = data.result?.[id]
    if (!doc) return null
    return {
      id: doc.uid,
      name: doc.name,
      description: doc.description,
      organism: doc.organism?.scientificname,
      geneType: doc.gene_type
    }
  }).filter(Boolean)
}

const autocompleteCache = new Map<string, Promise<{ name: string; type: string; id: string }[]>>()

export async function autocompleteSearch(query: string): Promise<{ name: string; type: string; id: string }[]> {
  if (query.length < 2) return []

  const key = query.toLowerCase().trim()
  if (autocompleteCache.has(key)) {
    return autocompleteCache.get(key)!
  }

  const promise = (async () => {
    const geneUrl = `${BASE_URL}/esearch.fcgi?db=gene&term=${encodeURIComponent(query)}[Gene Name]+AND+human[Organism]&retmode=json&retmax=5${getApiKeyParam()}`
    const diseaseUrl = `${BASE_URL}/esearch.fcgi?db=mesh&term=${encodeURIComponent(query)}&retmode=json&retmax=5${getApiKeyParam()}`

    const [geneRes, diseaseRes] = await Promise.allSettled([
      fetchWithTimeout(geneUrl, 4000),
      fetchWithTimeout(diseaseUrl, 4000)
    ])

    const results: { name: string; type: string; id: string }[] = []
    const seen = new Set<string>()

    // Gene results from NCBI Gene
    if (geneRes.status === 'fulfilled' && geneRes.value.ok) {
      const geneData = await geneRes.value.json()
      const ids = geneData.esearchresult?.idlist || []
      if (ids.length > 0) {
        const detailUrl = `${BASE_URL}/esummary.fcgi?db=gene&id=${ids.join(',')}&retmode=json${getApiKeyParam()}`
        const detailRes = await fetchWithTimeout(detailUrl, 4000)
        if (detailRes.ok) {
          const detailData = await detailRes.json()
          for (const id of ids) {
            const doc = detailData.result?.[id]
            if (doc?.name && !seen.has(doc.name.toLowerCase())) {
              seen.add(doc.name.toLowerCase())
              results.push({ name: doc.name, type: 'gene', id })
            }
          }
        }
      }
    }

    // Disease results from NCBI MeSH
    if (diseaseRes.status === 'fulfilled' && diseaseRes.value.ok) {
      const diseaseData = await diseaseRes.value.json()
      const ids = diseaseData.esearchresult?.idlist || []
      if (ids.length > 0) {
        const fetchUrl = `${BASE_URL}/esummary.fcgi?db=mesh&id=${ids.join(',')}&retmode=json${getApiKeyParam()}`
        const fetchRes = await fetchWithTimeout(fetchUrl, 4000)
        if (fetchRes.ok) {
          const fetchData = await fetchRes.json()
          for (const id of ids) {
            const doc = fetchData.result?.[id]
            const name = doc?.title || doc?.term || doc?.name
            if (name && !seen.has(name.toLowerCase())) {
              seen.add(name.toLowerCase())
              results.push({ name, type: 'disease', id })
            }
          }
        }
      }
    }

    // If no disease results, add clean capitalized query itself as a suggestion
    if (results.length === 0 && query.length >= 3) {
      const cleanName = query.charAt(0).toUpperCase() + query.slice(1).toLowerCase()
      results.push({ name: cleanName, type: 'disease', id: 'custom' })
    }

    return results
  })()

  autocompleteCache.set(key, promise)
  // Cache for 5 minutes
  setTimeout(() => autocompleteCache.delete(key), 5 * 60 * 1000)

  return promise
}

function extractDiseaseFromTitle(title: string, query: string): string | null {
  const lower = title.toLowerCase()
  const queryLower = query.toLowerCase()

  // Try to find the query in the title and extract a clean disease name
  const idx = lower.indexOf(queryLower)
  if (idx === -1) return null

  // Extract a window around the query to get a clean phrase
  const start = Math.max(0, idx - 30)
  const end = Math.min(title.length, idx + query.length + 30)
  let phrase = title.substring(start, end).trim()

  // Clean up: remove leading/trailing punctuation and words
  phrase = phrase.replace(/^[^a-zA-Z]+/, '').replace(/[^a-zA-Z]+$/, '')

  // Capitalize first letter
  if (phrase.length > 0) {
    phrase = phrase.charAt(0).toUpperCase() + phrase.slice(1)
  }

  return phrase.length >= 3 ? phrase : null
}

function parsePubMedXML(xml: string): NCBIResult[] {
  const results: NCBIResult[] = []
  const articleMatches = xml.match(/<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g) || []

  for (const article of articleMatches) {
    const pmid = article.match(/<PMID[^>]*>(\d+)<\/PMID>/)?.[1] || ''
    const title = article.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/)?.[1] || ''
    const abstract = article.match(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/)?.[1] || ''
    const year = article.match(/<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>/)?.[1] || ''
    const journal = article.match(/<Title>([\s\S]*?)<\/Title>/)?.[1] || ''

    const authors: string[] = []
    const authorMatches = article.match(/<Author[^>]*>[\s\S]*?<LastName>([\s\S]*?)<\/LastName>/g) || []
    for (const author of authorMatches) {
      const name = author.match(/<LastName>([\s\S]*?)<\/LastName>/)?.[1]
      if (name) authors.push(name)
    }

    if (pmid) {
      results.push({
        pmid,
        title: title.replace(/<[^>]+>/g, ''),
        authors,
        abstract: abstract.replace(/<[^>]+>/g, ''),
        date: year,
        journal
      })
    }
  }

  return results
}
