import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useResultStore } from '../stores/resultStore'
import { EntityType } from '../../shared/types'

interface Suggestion {
  name: string
  type: EntityType
  organism: string
}

export function SearchBar() {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { runQuery, isLoading } = useResultStore()

  const fetchSuggestions = useCallback(async (value: string) => {
    if (value.length < 2) {
      setSuggestions([])
      setShowDropdown(false)
      setSelectedSuggestion(null)
      return
    }

    try {
      const results = await window.api.searchSuggestions(value)
      setSuggestions(results)
      setShowDropdown(results.length > 0)
      setSelectedIndex(-1)
    } catch {
      setSuggestions([])
      setShowDropdown(false)
    }
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    setSelectedSuggestion(null)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(value)
    }, 300)
  }

  const handleSuggestionClick = (suggestion: Suggestion) => {
    setQuery(suggestion.name)
    setSelectedSuggestion(suggestion)
    setShowDropdown(false)
    setSuggestions([])
    runQuery(suggestion.name)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) {
      if (e.key === 'Enter' && selectedSuggestion) {
        e.preventDefault()
        runQuery(selectedSuggestion.name)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % suggestions.length)
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length)
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSuggestionClick(suggestions[selectedIndex])
        } else if (selectedSuggestion) {
          runQuery(selectedSuggestion.name)
        }
        break
      case 'Escape':
        setShowDropdown(false)
        setSelectedIndex(-1)
        break
    }
  }

  const handleBlur = (e: React.FocusEvent) => {
    if (dropdownRef.current && dropdownRef.current.contains(e.relatedTarget as Node)) {
      return
    }
    setTimeout(() => setShowDropdown(false), 150)
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  return (
    <div className="relative px-10 py-4 border-b border-border bg-surface z-40">
      <form onSubmit={(e) => e.preventDefault()} className="flex items-center gap-2.5 max-w-2xl mx-auto">
        <div className="flex-1 relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (suggestions.length > 0 && query.length >= 2) {
                setShowDropdown(true)
              }
            }}
            onBlur={handleBlur}
            placeholder="Search genes, diseases, or pathways..."
            className="w-full pl-9 pr-20 py-2 text-sm rounded bg-surface-raised border border-border text-slate-200 placeholder-slate-600 focus:border-accent-indigo/40 focus:ring-1 focus:ring-accent-indigo/20 outline-none transition-colors duration-150"
            disabled={isLoading}
            autoComplete="off"
          />
          {selectedSuggestion && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <span className={`chip-entity chip-entity--${selectedSuggestion.type}`}>
                {selectedSuggestion.type}
              </span>
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          onClick={() => {
            if (selectedSuggestion) {
              runQuery(selectedSuggestion.name)
            } else if (query.trim()) {
              runQuery(query.trim())
            }
          }}
          className="px-4 py-2 bg-accent-indigo/90 hover:bg-accent-indigo disabled:bg-surface-overlay disabled:text-slate-600 text-white text-xs font-medium rounded transition-colors duration-150"
        >
          {isLoading ? (
            <span className="flex items-center gap-1.5">
              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Searching
            </span>
          ) : 'Search'}
        </button>
      </form>

      {showDropdown && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute left-10 right-10 top-full mt-1 max-w-2xl mx-auto bg-surface-raised border border-border rounded-md shadow-elevated z-50 max-h-72 overflow-y-auto divide-y divide-border"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.name}-${index}`}
              onClick={() => handleSuggestionClick(suggestion)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`w-full px-3 py-2.5 text-left flex items-center justify-between transition-colors duration-100 ${
                index === selectedIndex ? 'bg-surface-overlay' : 'hover:bg-surface-overlay/50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-sm text-slate-300">
                  {suggestion.name}
                </span>
              </div>
              <span className={`chip-entity chip-entity--${suggestion.type}`}>
                {suggestion.type}
              </span>
            </button>
          ))}
          <div className="px-3 py-2 text-[10px] text-slate-600 font-medium">
            Press Enter to search
          </div>
        </div>
      )}

      {showDropdown && suggestions.length === 0 && query.length >= 2 && (
        <div
          ref={dropdownRef}
          className="absolute left-10 right-10 top-full mt-1 max-w-2xl mx-auto bg-surface-raised border border-border rounded-md shadow-elevated z-50"
        >
          <div className="px-3 py-3 text-xs text-slate-500">
            No results for "<span className="text-slate-300">{query}</span>"
          </div>
        </div>
      )}
    </div>
  )
}
