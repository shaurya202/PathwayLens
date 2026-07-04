import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NimClient } from '../nim'

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: vi.fn() } }
  }))
}))

const FULL_MOCK_RESPONSE = {
  overview: { text: 'BRCA1 is a tumor suppressor gene located on chromosome 17q21. It plays a critical role in DNA repair through homologous recombination.', confidence: { level: 'High', rationale: 'Well-established across 500+ PubMed studies' } },
  function: { text: 'The BRCA1 protein forms a complex with BARD1 to function as an E3 ubiquitin ligase. It is essential for double-strand break repair, cell cycle checkpoint activation, and transcriptional regulation.', confidence: { level: 'High', rationale: 'Multiple UniProt and Ensembl entries confirm function' } },
  pathways: { text: 'BRCA1 is central to the homologous recombination repair pathway. It interacts with RAD51, PALB2, and the MRN complex. It also participates in the Fanconi anemia pathway.', confidence: { level: 'High', rationale: 'Reactome pathway R-HSA-5685938 and related pathways documented' } },
  biomarkers: { text: 'BRCA1 mutations are biomarkers for hereditary breast and ovarian cancer syndrome. Loss of BRCA1 expression is associated with triple-negative breast cancer.', confidence: { level: 'High', rationale: 'Clinical biomarker with FDA-approved companion diagnostics' } },
  clinicalNotes: { text: 'Germline pathogenic variants in BRCA1 confer 60-80% lifetime risk of breast cancer and 20-40% risk of ovarian cancer. PARP inhibitors (olaparib, rucaparib) are effective in BRCA1-mutated cancers.', confidence: { level: 'High', rationale: 'Multiple phase III clinical trials and FDA approvals' } },
  readNext: [
    { title: 'BRCA1 and DNA Repair in Cancer', url: 'https://pubmed.ncbi.nlm.nih.gov/12345678', reason: 'Comprehensive review of BRCA1 mechanisms' },
    { title: 'PARP Inhibitors in BRCA-Mutated Cancers', url: 'https://pubmed.ncbi.nlm.nih.gov/23456789', reason: 'Clinical efficacy data' }
  ]
}

describe('NimClient', () => {
  let nimClient: NimClient
  let mockCreate: any

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NIM_API_KEY = 'test-api-key'
    nimClient = new NimClient()
    mockCreate = (nimClient as any).client.chat.completions.create
  })

  it('initializes with API key from environment', () => {
    expect(nimClient).toBeDefined()
  })

  it('throws error when NIM_API_KEY is not set', () => {
    delete process.env.NIM_API_KEY
    expect(() => new NimClient()).toThrow('NIM_API_KEY')
  })

  it('calls NIM API with correct parameters', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(FULL_MOCK_RESPONSE) } }]
    })

    await nimClient.synthesize('BRCA1', 'Some context about BRCA1')

    expect(mockCreate).toHaveBeenCalledWith({
      model: 'meta/llama-3.1-8b-instruct',
      messages: expect.arrayContaining([
        expect.objectContaining({ role: 'system' }),
        expect.objectContaining({ role: 'user' })
      ]),
      temperature: 0.3,
      max_tokens: 4096
    })
  })

  it('parses nested confidence JSON response from NIM', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(FULL_MOCK_RESPONSE) } }]
    })

    const result = await nimClient.synthesize('BRCA1', 'Context')

    expect(result).toEqual(FULL_MOCK_RESPONSE)
    expect(result.overview.text).toContain('BRCA1')
    expect(result.overview.confidence.level).toBe('High')
    expect(result.overview.confidence.rationale).toContain('PubMed')
  })

  it('normalizes flat confidence format to nested', async () => {
    const flatResponse = {
      overview: { text: 'Test', confidence: 'Medium', rationale: 'Some sources' },
      function: { text: 'Test', confidence: 'Low', rationale: 'Limited data' },
      pathways: { text: 'Test', confidence: 'High', rationale: 'Well documented' },
      biomarkers: { text: 'Test', confidence: 'Medium', rationale: 'Moderate evidence' },
      clinicalNotes: { text: 'Test', confidence: 'Low', rationale: 'Few studies' },
      readNext: []
    }

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(flatResponse) } }]
    })

    const result = await nimClient.synthesize('BRCA1', 'Context')

    expect(result.overview.confidence).toEqual({ level: 'Medium', rationale: 'Some sources' })
    expect(result.function.confidence).toEqual({ level: 'Low', rationale: 'Limited data' })
  })

  it('handles invalid JSON response gracefully', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'This is not JSON' } }]
    })

    await expect(nimClient.synthesize('BRCA1', 'Context')).rejects.toThrow('Invalid JSON')
  })

  it('handles API errors gracefully', async () => {
    mockCreate.mockRejectedValue(new Error('API rate limit exceeded'))

    await expect(nimClient.synthesize('BRCA1', 'Context')).rejects.toThrow('API rate limit exceeded')
  })

  it('includes context data in user prompt', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(FULL_MOCK_RESPONSE) } }]
    })

    await nimClient.synthesize('BRCA1', 'Gene data: BRCA1 is located on chromosome 17')

    const userMessage = mockCreate.mock.calls[0][0].messages[1]
    expect(userMessage.content).toContain('Gene data: BRCA1 is located on chromosome 17')
  })

  it('rejects response missing required sections', async () => {
    const incompleteResponse = {
      overview: { text: 'Test', confidence: { level: 'High', rationale: 'Test' } },
      function: { text: 'Test', confidence: { level: 'High', rationale: 'Test' } },
      pathways: { text: 'Test', confidence: { level: 'High', rationale: 'Test' } },
      biomarkers: { text: 'Test', confidence: { level: 'High', rationale: 'Test' } },
      clinicalNotes: { text: 'Test', confidence: { level: 'High', rationale: 'Test' } }
    }

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(incompleteResponse) } }]
    })

    await expect(nimClient.synthesize('BRCA1', 'Context')).rejects.toThrow('Missing required section: readNext')
  })

  it('rejects invalid confidence levels', async () => {
    const badConfidence = {
      ...FULL_MOCK_RESPONSE,
      overview: { text: 'Test', confidence: { level: 'Very High', rationale: 'Test' }, rationale: 'Test' }
    }

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(badConfidence) } }]
    })

    await expect(nimClient.synthesize('BRCA1', 'Context')).rejects.toThrow('Invalid confidence level')
  })
})
