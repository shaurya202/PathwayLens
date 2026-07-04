import { describe, it, expect, vi, beforeEach } from 'vitest'
import { lookupGene, searchGenes } from '../ensembl'

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('Ensembl API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('looks up gene by symbol', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'ENSG00000012048',
        display_name: 'BRCA1',
        description: 'BRCA1 DNA repair associated',
        biotype: 'protein_coding',
        xrefs: [
          { database: 'HGNC', primary_id: 'HGNC:1100' },
          { database: 'UniProt', primary_id: 'P38398' }
        ]
      })
    })

    const result = await lookupGene('BRCA1')

    expect(mockFetch).toHaveBeenCalled()
    expect(result).not.toBeNull()
    expect(result!.displayName).toBe('BRCA1')
    expect(result!.description).toContain('BRCA1')
  })

  it('searches for genes', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'ENSG00000012048',
        display_name: 'BRCA1',
        description: 'BRCA1 DNA repair associated',
        biotype: 'protein_coding',
        xrefs: []
      })
    })

    const results = await searchGenes('BRCA1')

    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('ENSG00000012048')
  })

  it('handles gene not found', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    })

    const result = await lookupGene('NONEXISTENT')
    expect(result).toBeNull()
  })

  it('handles API errors gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    await expect(lookupGene('BRCA1')).rejects.toThrow('Network error')
  })
})
