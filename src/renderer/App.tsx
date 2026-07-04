import React, { useEffect, useCallback, useState } from 'react'
import { SearchBar } from './components/SearchBar'
import { Sidebar } from './components/Sidebar'
import { SummaryPanel } from './components/SummaryPanel'
import { SourceCard } from './components/SourceCard'
import { WhatToReadNext } from './components/WhatToReadNext'
import { useResultStore } from './stores/resultStore'

function App() {
  const { currentResult, isLoading, error } = useResultStore()
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    const textFile = files.find(f => f.name.endsWith('.txt') || f.name.endsWith('.md'))
    const pdfFile = files.find(f => f.name.endsWith('.pdf'))

    if (textFile) {
      const text = await textFile.text()
      useResultStore.getState().runQuery(text.substring(0, 500))
    } else if (pdfFile) {
      useResultStore.getState().runQuery(`Analyze this PDF: ${pdfFile.name}`)
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        document.querySelector<HTMLInputElement>('input[type="text"]')?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="flex h-screen bg-surface text-slate-200 overflow-hidden relative noise-overlay">
      <Sidebar />

      <main
        className="flex-1 flex flex-col overflow-hidden relative z-10"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <SearchBar />

        <div className="flex-1 overflow-y-auto px-10 py-8">
          {isLoading && (
            <div className="max-w-3xl mx-auto space-y-5">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-6 bg-surface-raised rounded w-1/3 skeleton"></div>
              </div>
              <div className="space-y-4">
                {[1, 2, 3, 4].map(n => (
                  <div key={n} className="bg-surface-raised border border-border rounded-lg p-5 space-y-3 skeleton">
                    <div className="h-3.5 bg-surface-overlay rounded w-1/4"></div>
                    <div className="space-y-2">
                      <div className="h-2.5 bg-surface-overlay rounded w-full"></div>
                      <div className="h-2.5 bg-surface-overlay rounded w-5/6"></div>
                      <div className="h-2.5 bg-surface-overlay rounded w-4/5"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="max-w-3xl mx-auto bg-red-950/20 border border-red-500/20 rounded-lg p-4 mb-5 animate-fade-in">
              <div className="flex items-start gap-3">
                <svg className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <div>
                  <h4 className="font-semibold text-red-400 text-xs uppercase tracking-wide">Query Failed</h4>
                  <p className="text-red-300/70 text-xs mt-1 leading-relaxed">{error}</p>
                </div>
              </div>
            </div>
          )}

          {!isLoading && !error && !currentResult && (
            <div className="flex flex-col items-center justify-center h-full text-center max-w-lg mx-auto my-auto py-12">
              <div className="w-12 h-12 rounded-lg bg-surface-raised border border-border flex items-center justify-center mb-5">
                <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-slate-200 tracking-tight mb-1.5">
                PathwayLens
              </h2>
              <p className="text-slate-500 text-sm leading-relaxed mb-7 max-w-sm">
                Query biological entities to fetch structured summaries from curated research databases.
              </p>
              
              <div className="grid grid-cols-3 gap-2 w-full max-w-md mb-7">
                {['BRCA1', 'Alzheimer disease', 'MAPK pathway'].map(sample => (
                  <button
                    key={sample}
                    onClick={() => useResultStore.getState().runQuery(sample)}
                    className="px-3 py-2 bg-surface-raised hover:bg-surface-overlay border border-border hover:border-border-strong text-slate-400 hover:text-slate-200 text-xs font-medium rounded transition-colors duration-150"
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>
          )}

          {currentResult && (
            <div className="max-w-3xl mx-auto space-y-6 animate-slide-up">
              <SummaryPanel sections={currentResult.sections} />
              <WhatToReadNext readings={currentResult.sections.readNext} />

              {currentResult.sources.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Sources
                    </h3>
                    <span className="text-[10px] text-slate-600 font-medium">
                      {currentResult.sources.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {currentResult.sources.map((source) => (
                      <SourceCard key={source.id} source={source} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {isDragging && (
          <div className="absolute inset-0 bg-surface/90 backdrop-blur-sm border border-dashed border-slate-600 rounded-lg m-3 flex flex-col items-center justify-center z-50 pointer-events-none">
            <svg className="w-8 h-8 text-slate-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
            </svg>
            <p className="text-slate-400 text-sm font-medium">Drop file to analyze</p>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
