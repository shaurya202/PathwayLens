import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchPathways, fetchPathwayDetails } from '../reactome'

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('Reactome API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('searches for pathways by name', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            stId: 'R-HSA-5685938',
            displayName: 'HDR through Homologous Recombination (HRR)',
            summation: ['DNA repair by homologous recombination'],
            isInferred: false
          }
        ]
      })
    })

    const results = await searchPathways('BRCA1')

    expect(mockFetch).toHaveBeenCalled()
    expect(results).toHaveLength(1)
    expect(results[0].stableId).toBe('R-HSA-5685938')
  })

  it('fetches pathway details by stable ID', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        stId: 'R-HSA-5685938',
        displayName: 'HDR through Homologous Recombination',
        summation: ['DNA repair pathway']
      })
    })

    const details = await fetchPathwayDetails('R-HSA-5685938')

    expect(details).not.toBeNull()
    expect(details!.stableId).toBe('R-HSA-5685938')
    expect(details!.pathwayName).toContain('Homologous Recombination')
  })

  it('handles empty search results', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] })
    })

    const results = await searchPathways('NONEXISTENT')
    expect(results).toEqual([])
  })

  it('handles API errors gracefully', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    })

    await expect(searchPathways('BRCA1')).rejects.toThrow('Reactome API error')
  })
})
