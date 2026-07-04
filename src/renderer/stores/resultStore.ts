import { create } from 'zustand'
import { QueryResult, CacheEntry } from '../../shared/types'

interface ResultState {
  currentResult: QueryResult | null
  history: CacheEntry[]
  isLoading: boolean
  error: string | null
  setCurrentResult: (result: QueryResult | null) => void
  setHistory: (history: CacheEntry[]) => void
  setIsLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  runQuery: (query: string) => Promise<void>
  loadHistory: () => Promise<void>
}

export const useResultStore = create<ResultState>((set) => ({
  currentResult: null,
  history: [],
  isLoading: false,
  error: null,

  setCurrentResult: (result) => set({ currentResult: result }),
  setHistory: (history) => set({ history }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  runQuery: async (query: string) => {
    set({ isLoading: true, error: null })
    try {
      const result = await window.api.runQuery(query)
      set({ currentResult: result, isLoading: false })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Query failed', isLoading: false })
    }
  },

  loadHistory: async () => {
    try {
      const history = await window.api.getHistory()
      set({ history })
    } catch (err) {
      console.error('Failed to load history:', err)
    }
  }
}))
