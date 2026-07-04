import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchProteins, fetchProteinDetails } from '../uniprot'

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('UniProt API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('searches for proteins by gene name', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            primaryAccession: 'P38398',
            proteins: [{ proteinDescription: { recommendedName: { fullName: { value: 'Breast cancer type 1 susceptibility protein' } } } }],
            organism: { scientificName: 'Homo sapiens' },
            comments: []
          }
        ]
      })
    })

    const results = await searchProteins('BRCA1')

    expect(mockFetch).toHaveBeenCalled()
    expect(results).toHaveLength(1)
    expect(results[0].accession).toBe('P38398')
  })

  it('fetches protein details by accession', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        primaryAccession: 'P38398',
        proteins: [{ proteinDescription: { recommendedName: { fullName: { value: 'BRCA1 protein' } } } }],
        organism: { scientificName: 'Homo sapiens' },
        comments: [
          { commentType: 'FUNCTION', texts: [{ value: 'DNA repair' }] },
          { commentType: 'SUBCELLULAR LOCATION', texts: [{ value: 'Nucleus' }] }
        ],
        pathways: [{ name: 'Homologous recombination' }]
      })
    })

    const details = await fetchProteinDetails('P38398')

    expect(details.accession).toBe('P38398')
    expect(details.function).toContain('DNA repair')
  })

  it('handles empty search results', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] })
    })

    const results = await searchProteins('NONEXISTENT')
    expect(results).toEqual([])
  })

  it('handles API errors gracefully', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    })

    await expect(searchProteins('BRCA1')).rejects.toThrow('UniProt API error')
  })
})
