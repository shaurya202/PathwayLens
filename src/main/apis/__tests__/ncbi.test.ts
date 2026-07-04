import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchGenes, fetchGeneDetails } from '../ncbi'

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('NCBI API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('searches for genes by name', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        esearchresult: { idlist: ['672', '675'] }
      })
    })

    const results = await searchGenes('BRCA1')

    expect(mockFetch).toHaveBeenCalled()
    expect(results).toEqual(['672', '675'])
  })

  it('handles empty search results', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        esearchresult: { idlist: [] }
      })
    })

    const results = await searchGenes('NONEXISTENT')
    expect(results).toEqual([])
  })

  it('fetches gene details by ID', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          '672': {
            uid: '672',
            name: 'BRCA1',
            description: 'Breast cancer 1',
            organism: { scientificname: 'Homo sapiens' },
            gene_type: 'protein-coding'
          }
        }
      })
    })

    const details = await fetchGeneDetails(['672'])

    expect(mockFetch).toHaveBeenCalled()
    expect(details).toHaveLength(1)
    expect(details[0].name).toBe('BRCA1')
  })

  it('handles API errors gracefully', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests'
    })

    await expect(searchGenes('BRCA1')).rejects.toThrow('NCBI API error')
  })

  it('handles network errors', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    await expect(searchGenes('BRCA1')).rejects.toThrow('Network error')
  })
})
