import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { existsSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'

// Mock Electron before importing CacheStore
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/tmp/test-pathwaylens')
  }
}))

const CacheStoreModule = await import('../cache')
const CacheStore = CacheStoreModule.CacheStore

const TEST_CACHE_DIR = join(__dirname, '__test_cache__')

describe('CacheStore', () => {
  let cache: InstanceType<typeof CacheStore>

  beforeEach(() => {
    if (!existsSync(TEST_CACHE_DIR)) {
      mkdirSync(TEST_CACHE_DIR, { recursive: true })
    }
    cache = new CacheStore(TEST_CACHE_DIR)
  })

  afterEach(() => {
    if (existsSync(TEST_CACHE_DIR)) {
      rmSync(TEST_CACHE_DIR, { recursive: true, force: true })
    }
  })

  it('saves and retrieves a query result', async () => {
    const mockResult = {
      query: 'BRCA1',
      entity: { canonicalName: 'BRCA1', entityType: 'gene' as const, synonyms: [] },
      sections: {} as any,
      sources: [],
      timestamp: new Date().toISOString()
    }

    await cache.saveQuery('BRCA1', mockResult)
    const retrieved = await cache.getQuery('BRCA1')

    expect(retrieved).not.toBeNull()
    expect(retrieved!.query).toBe('BRCA1')
    expect(retrieved!.result.entity.canonicalName).toBe('BRCA1')
  })

  it('returns null for non-existent query', async () => {
    const result = await cache.getQuery('NONEXISTENT')
    expect(result).toBeNull()
  })

  it('returns recent queries sorted by timestamp', async () => {
    await cache.saveQuery('BRCA1', { query: 'BRCA1', timestamp: '2026-01-01' } as any)
    await cache.saveQuery('TP53', { query: 'TP53', timestamp: '2026-01-02' } as any)
    await cache.saveQuery('EGFR', { query: 'EGFR', timestamp: '2026-01-03' } as any)

    const history = await cache.getRecentQueries(2)

    expect(history).toHaveLength(2)
    expect(history[0].query).toBe('EGFR')
    expect(history[1].query).toBe('TP53')
  })

  it('handles empty history gracefully', async () => {
    const history = await cache.getRecentQueries()
    expect(history).toEqual([])
  })

  it('overwrites existing query with same name', async () => {
    await cache.saveQuery('BRCA1', { query: 'BRCA1', customField: 1 } as any)
    await cache.saveQuery('BRCA1', { query: 'BRCA1', customField: 2 } as any)

    const result = await cache.getQuery('BRCA1')
    expect((result!.result as any).customField).toBe(2)
  })

  it('limits history to specified count', async () => {
    for (let i = 0; i < 10; i++) {
      await cache.saveQuery(`gene_${i}`, { query: `gene_${i}`, timestamp: `2026-01-${String(i + 1).padStart(2, '0')}` } as any)
    }

    const history = await cache.getRecentQueries(5)
    expect(history).toHaveLength(5)
  })
})
