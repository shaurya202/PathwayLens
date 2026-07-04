import { RawData, EntityInfo, EntityType } from '../../shared/types'
import { searchGenes as searchNCBI, searchPubmed, fetchGeneDetails, autocompleteSearch } from './ncbi'
import { searchProteins } from './uniprot'
import { lookupGene as lookupEnsembl } from './ensembl'
import { searchPathways } from './reactome'
import { CacheStore } from '../cache'

export async function fetchGeneData(query: string, _entityType?: EntityType): Promise<RawData> {
  // Always fetch everything in parallel — entity type optimization was causing delays
  const [ncbi, uniprot, ensembl, reactome, pubmed] = await Promise.allSettled([
    fetchNCBIData(query),
    searchProteins(query, 10),
    lookupEnsembl(query),
    searchPathways(query, 10),
    searchPubmed(query, 10)
  ])

  return {
    ncbi: ncbi.status === 'fulfilled' ? ncbi.value : { gene: null, abstracts: [] },
    uniprot: uniprot.status === 'fulfilled' ? uniprot.value : [],
    ensembl: ensembl.status === 'fulfilled' ? (ensembl.value ? [ensembl.value] : []) : [],
    reactome: reactome.status === 'fulfilled' ? reactome.value : [],
    pubmed: pubmed.status === 'fulfilled' ? pubmed.value : []
  } as any
}

async function fetchNCBIData(query: string) {
  const geneIds = await searchNCBI(query)
  const geneDetails = geneIds.length > 0 ? await fetchGeneDetails(geneIds.slice(0, 5)) : []

  return {
    gene: geneDetails[0] || null,
    abstracts: []
  }
}

export async function resolveEntity(query: string): Promise<EntityInfo> {
  const [geneResult, pathwayResult] = await Promise.allSettled([
    lookupEnsembl(query),
    searchPathways(query)
  ])

  const isGene = geneResult.status === 'fulfilled' && geneResult.value !== null
  const isPathway = pathwayResult.status === 'fulfilled' && pathwayResult.value.length > 0

  let entityType: EntityType = 'unknown'
  if (isGene) entityType = 'gene'
  else if (isPathway) entityType = 'pathway'
  else entityType = 'disease' // Default to disease for NCBI MeSH queries

  const gene = isGene ? geneResult.value : null
  const synonyms: string[] = []

  if (gene) {
    if (gene.xrefs) {
      for (const xref of gene.xrefs) {
        if (xref.database === 'HGNC' || xref.database === 'UniProt') {
          synonyms.push(xref.identifier)
        }
      }
    }
  }

  return {
    canonicalName: gene?.displayName || query,
    entityType,
    organism: 'Homo sapiens',
    synonyms,
    description: gene?.description || ''
  }
}

export async function getSuggestions(query: string): Promise<{ name: string; type: EntityType; organism: string }[]> {
  if (query.length < 2) return []

  const results: { name: string; type: EntityType; organism: string }[] = []
  const seen = new Set<string>()

  // First: add matching cached queries (highest priority)
  try {
    const cache = new CacheStore()
    const history = await cache.getRecentQueries(50)
    for (const entry of history) {
      const name = entry.result?.entity?.canonicalName || entry.query
      if (name.toLowerCase().includes(query.toLowerCase()) && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase())
        results.push({
          name,
          type: entry.result?.entity?.entityType || 'disease',
          organism: 'Homo sapiens'
        })
      }
    }
  } catch {
    // Cache not available, continue
  }

  // Second: add NCBI results
  const ncboResults = await autocompleteSearch(query)
  for (const r of ncboResults) {
    if (!seen.has(r.name.toLowerCase())) {
      seen.add(r.name.toLowerCase())
      results.push({
        name: r.name,
        type: (r.type as EntityType) || 'disease',
        organism: 'Homo sapiens'
      })
    }
  }

  return results
}

function formatContextData(data: any): string {
  const parts: string[] = []

  if (data.ncbi?.gene) {
    parts.push(`Gene: ${data.ncbi.gene.name} - ${data.ncbi.gene.description}`)
  }

  // Use pubmed abstracts (always fetched) or fall back to ncbi abstracts
  const abstracts = data.pubmed || data.ncbi?.abstracts || []
  if (abstracts.length > 0) {
    parts.push('PubMed Abstracts:')
    for (const abs of abstracts.slice(0, 5)) {
      parts.push(`- Title: ${abs.title} (${abs.date})`)
      parts.push(`  URL: https://pubmed.ncbi.nlm.nih.gov/${abs.pmid}/`)
      parts.push(`  Abstract: ${abs.abstract.substring(0, 300)}`)
    }
  }

  if (data.uniprot?.length > 0) {
    parts.push('UniProt Protein Data:')
    for (const up of data.uniprot.slice(0, 5)) {
      parts.push(`- Protein Name: ${up.name}`)
      parts.push(`  URL: https://www.uniprot.org/uniprot/${up.accession}`)
      parts.push(`  Function: ${up.function}`)
      if (up.pathways?.length > 0) {
        parts.push(`  Pathways: ${up.pathways.join('; ')}`)
      }
    }
  }

  if (data.ensembl?.length > 0) {
    parts.push('Ensembl Gene Data:')
    for (const en of data.ensembl.slice(0, 3)) {
      parts.push(`- Gene Symbol: ${en.displayName}`)
      parts.push(`  URL: https://ensembl.org/Homo_sapiens/Gene/Summary?g=${en.id}`)
      parts.push(`  Description: ${en.description}`)
    }
  }

  if (data.reactome?.length > 0) {
    parts.push('Reactome Pathways:')
    for (const re of data.reactome.slice(0, 5)) {
      parts.push(`- Pathway Name: ${re.pathwayName}`)
      parts.push(`  URL: ${re.url}`)
      parts.push(`  Description: ${re.summation?.join(' ') || 'No description'}`)
    }
  }

  return parts.join('\n')
}

export { formatContextData }
