import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Electron
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn()
  },
  dialog: {
    showSaveDialog: vi.fn().mockResolvedValue({ canceled: true })
  },
  BrowserWindow: {
    getFocusedWindow: vi.fn().mockReturnValue(null)
  },
  shell: {
    openExternal: vi.fn()
  }
}))

// Mock child modules
vi.mock('../nim', () => ({
  NimClient: vi.fn().mockImplementation(() => ({
    synthesize: vi.fn().mockResolvedValue({
      overview: { text: 'Test', confidence: 'High', rationale: 'Test' },
      function: { text: 'Test', confidence: 'High', rationale: 'Test' },
      pathways: { text: 'Test', confidence: 'High', rationale: 'Test' },
      biomarkers: { text: 'Test', confidence: 'High', rationale: 'Test' },
      clinicalNotes: { text: 'Test', confidence: 'High', rationale: 'Test' },
      readNext: []
    })
  }))
}))

vi.mock('../cache', () => ({
  CacheStore: vi.fn().mockImplementation(() => ({
    getQuery: vi.fn().mockResolvedValue(null),
    saveQuery: vi.fn().mockResolvedValue(undefined),
    getRecentQueries: vi.fn().mockResolvedValue([])
  }))
}))

vi.mock('../apis', () => ({
  fetchGeneData: vi.fn().mockResolvedValue({
    ncbi: { gene: null, abstracts: [] },
    uniprot: [],
    ensembl: [],
    reactome: []
  }),
  resolveEntity: vi.fn().mockResolvedValue({
    canonicalName: 'BRCA1',
    entityType: 'gene',
    organism: 'Homo sapiens',
    synonyms: [],
    description: ''
  }),
  formatContextData: vi.fn().mockReturnValue('')
}))

const { registerIpcHandlers } = await import('../ipc')
const { ipcMain } = await import('electron')

describe('IPC Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registers all required IPC handlers', () => {
    const mockIpcMain = { handle: vi.fn() }
    registerIpcHandlers(mockIpcMain as any)

    expect(mockIpcMain.handle).toHaveBeenCalledWith('query:run', expect.any(Function))
    expect(mockIpcMain.handle).toHaveBeenCalledWith('query:history', expect.any(Function))
    expect(mockIpcMain.handle).toHaveBeenCalledWith('query:export', expect.any(Function))
    expect(mockIpcMain.handle).toHaveBeenCalledWith('shell:openExternal', expect.any(Function))
  })

  it('query:run handler runs query and returns result', async () => {
    registerIpcHandlers(ipcMain as any)

    const runQueryHandler = (ipcMain.handle as any).mock.calls.find(
      (call: any[]) => call[0] === 'query:run'
    )[1]

    const result = await runQueryHandler({}, 'BRCA1')
    expect(result).toBeDefined()
    expect(result.entity.canonicalName).toBe('BRCA1')
  })

  it('query:history handler returns cached queries', async () => {
    registerIpcHandlers(ipcMain as any)

    const historyHandler = (ipcMain.handle as any).mock.calls.find(
      (call: any[]) => call[0] === 'query:history'
    )[1]

    const result = await historyHandler()
    expect(result).toEqual([])
  })

  it('query:export handler returns null when dialog is canceled', async () => {
    registerIpcHandlers(ipcMain as any)

    const exportHandler = (ipcMain.handle as any).mock.calls.find(
      (call: any[]) => call[0] === 'query:export'
    )[1]

    const result = await exportHandler({}, 'markdown', { entity: { canonicalName: 'test' } })
    expect(result).toBeNull()
  })
})
