import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'fs'
import { join } from 'path'
import { QueryResult, CacheEntry } from '../shared/types'
import { app } from 'electron'

export class CacheStore {
  private cacheDir: string
  private indexFile: string

  constructor(cacheDir?: string) {
    if (cacheDir) {
      this.cacheDir = cacheDir
    } else {
      const userDataPath = app.getPath('userData')
      this.cacheDir = join(userDataPath, 'cache')
    }
    this.indexFile = join(this.cacheDir, 'index.json')

    if (!existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true })
    }
    if (!existsSync(this.indexFile)) {
      writeFileSync(this.indexFile, JSON.stringify([], null, 2))
    }
  }

  private readIndex(): CacheEntry[] {
    try {
      const data = readFileSync(this.indexFile, 'utf-8')
      return JSON.parse(data)
    } catch {
      return []
    }
  }

  private writeIndex(entries: CacheEntry[]): void {
    writeFileSync(this.indexFile, JSON.stringify(entries, null, 2))
  }

  private getCacheFilePath(query: string): string {
    const safeName = query.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
    return join(this.cacheDir, `${safeName}.json`)
  }

  async saveQuery(query: string, result: QueryResult): Promise<void> {
    const filePath = this.getCacheFilePath(query)
    writeFileSync(filePath, JSON.stringify(result, null, 2))

    const entries = this.readIndex()
    const existingIndex = entries.findIndex(e => e.query.toLowerCase() === query.toLowerCase())

    const entry: CacheEntry = {
      id: existingIndex >= 0 ? entries[existingIndex].id : Date.now().toString(),
      query,
      result,
      createdAt: new Date().toISOString()
    }

    if (existingIndex >= 0) {
      entries[existingIndex] = entry
    } else {
      entries.push(entry)
    }

    this.writeIndex(entries)
  }

  async getQuery(query: string): Promise<CacheEntry | null> {
    const entries = this.readIndex()
    const entry = entries.find(e => e.query.toLowerCase() === query.toLowerCase())
    if (!entry) return null

    try {
      const filePath = this.getCacheFilePath(query)
      const data = readFileSync(filePath, 'utf-8')
      entry.result = JSON.parse(data)
      return entry
    } catch {
      return null
    }
  }

  async getRecentQueries(limit: number = 10): Promise<CacheEntry[]> {
    const entries = this.readIndex()
    return entries
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit)
  }

  async deleteQuery(query: string): Promise<void> {
    const entries = this.readIndex()
    const filtered = entries.filter(e => e.query.toLowerCase() !== query.toLowerCase())
    this.writeIndex(filtered)

    const filePath = this.getCacheFilePath(query)
    if (existsSync(filePath)) {
      unlinkSync(filePath)
    }
  }
}
