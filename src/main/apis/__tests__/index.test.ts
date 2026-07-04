import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchGeneData, resolveEntity } from '../index'

vi.mock('../ncbi', () => ({
  searchGenes: vi.fn().mockResolvedValue(['672']),
  searchPubmed: vi.fn().mockResolvedValue([{
    pmid: '12345',
    title: 'BRCA1 in DNA repair',
    abstract: 'This paper discusses BRCA1 and its role in DNA repair mechanisms...',
    date: '2024-01-01',
    authors: ['Smith J'],
    journal: 'Nature'
  }]),
  searchAbstracts: vi.fn().mockResolvedValue([{
    pmid: '12345',
    title: 'BRCA1 in DNA repair',
    abstract: 'This paper discusses BRCA1...',
    date: '2024-01-01'
  }]),
  fetchGeneDetails: vi.fn().mockResolvedValue([{
    name: 'BRCA1',
    description: 'Breast cancer 1',
    organism: 'Homo sapiens'
  }]),
  autocompleteSearch: vi.fn().mockResolvedValue([])
}))

vi.mock('../uniprot', () => ({
  searchProteins: vi.fn().mockResolvedValue([{
    accession: 'P38398',
    name: 'BRCA1_HUMAN',
    organism: 'Homo sapiens'
  }]),
  fetchProteinDetails: vi.fn().mockResolvedValue({
    accession: 'P38398',
    function: 'DNA repair protein',
    pathways: ['Homologous recombination']
  })
}))

vi.mock('../ensembl', () => ({
  lookupGene: vi.fn().mockImplementation(async (query: string) => {
    const lower = query.toLowerCase()
    if (lower.includes('nonexistent') || lower.includes('alzheimer') || lower.includes('totallyunknown')) return null
    return {
      id: 'ENSG00000012048',
      displayName: query,
      description: `${query} gene`,
      xrefs: [{ database: 'HGNC', identifier: 'HGNC:1100' }]
    }
  }),
  searchGenes: vi.fn().mockResolvedValue([])
}))

vi.mock('../reactome', () => ({
  searchPathways: vi.fn().mockImplementation(async (query: string) => {
    const lower = query.toLowerCase()
    if (lower.includes('nonexistent') || lower.includes('alzheimer') || lower.includes('totallyunknown')) return []
    return [{
      stableId: 'R-HSA-5685938',
      pathwayName: 'HDR through Homologous Recombination',
      summation: ['DNA repair']
    }]
  }),
  fetchPathwayDetails: vi.fn()
}))

describe('API Orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches data from all APIs in parallel', async () => {
    const result = await fetchGeneData('BRCA1')

    expect(result).toBeDefined()
    expect(result.ncbi).toBeDefined()
    expect(result.uniprot).toHaveLength(1)
    expect(result.ensembl).toHaveLength(1)
    expect(result.reactome).toHaveLength(1)
  })

  it('resolves entity type correctly for genes', async () => {
    const geneEntity = await resolveEntity('BRCA1')
    expect(geneEntity.entityType).toBe('gene')
  })

  it('resolves entity type correctly for diseases', async () => {
    const diseaseEntity = await resolveEntity('Alzheimer disease')
    expect(diseaseEntity.entityType).toBe('disease')
  })

  it('handles API failures gracefully', async () => {
    const { searchGenes } = await import('../ncbi')
    vi.mocked(searchGenes).mockRejectedValue(new Error('API down'))

    const result = await fetchGeneData('BRCA1')
    expect(result).toBeDefined()
  })

  it('returns empty arrays for unknown entities', async () => {
    const result = await fetchGeneData('TOTALLYUNKNOWN')
    expect(result.ensembl).toEqual([])
  })
})
