import React, { useEffect } from 'react'
import { useResultStore } from '../stores/resultStore'

export function Sidebar() {
  const { currentResult, history, loadHistory } = useResultStore()

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  return (
    <aside className="w-60 bg-surface border-r border-border flex flex-col h-full overflow-hidden z-20">
      <div className="px-4 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-accent-indigo/15 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-accent-indigo" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xs font-semibold text-slate-200 tracking-tight">PathwayLens</h1>
            <p className="text-[9px] text-slate-600 font-medium">v1.0</p>
          </div>
        </div>
      </div>

      {currentResult && (
        <div className="px-4 py-3.5 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">
              Active Entity
            </span>
            <span className={`chip-entity chip-entity--${currentResult.entity.entityType}`}>
              {currentResult.entity.entityType}
            </span>
          </div>
          <h2 className="text-sm font-semibold text-slate-200 leading-snug mb-2">
            {currentResult.entity.canonicalName}
          </h2>
          <div className="space-y-1 text-xs text-slate-500">
            {currentResult.entity.organism && (
              <p className="flex justify-between">
                <span className="text-slate-600">Organism</span>
                <span className="text-slate-400 italic">{currentResult.entity.organism}</span>
              </p>
            )}
          </div>
          {currentResult.entity.synonyms.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1">
              {currentResult.entity.synonyms.slice(0, 3).map((syn, i) => (
                <span key={i} className="px-1.5 py-0.5 bg-surface-overlay text-[9px] text-slate-500 rounded">
                  {syn}
                </span>
              ))}
            </div>
          )}
          <div className="mt-3 pt-2.5 border-t border-border flex items-center gap-3 text-[10px] text-slate-500">
            <span>{currentResult.sources.length} sources</span>
            <span className="text-slate-700">|</span>
            <span>{currentResult.sections.readNext.length} recommendations</span>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <h3 className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider mb-2">
          Recent
        </h3>
        {history.length === 0 ? (
          <p className="text-[10px] text-slate-700 italic">No history</p>
        ) : (
          <ul className="space-y-0.5">
            {history.map((entry) => (
              <li key={entry.id}>
                <button
                  onClick={() => useResultStore.getState().setCurrentResult(entry.result)}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-surface-overlay transition-colors duration-100 group"
                >
                  <p className="text-xs text-slate-400 truncate group-hover:text-slate-200 transition-colors">
                    {entry.query}
                  </p>
                  <p className="text-[9px] text-slate-700 mt-0.5">
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="px-4 py-3 border-t border-border">
        <p className="text-[9px] text-slate-600 leading-relaxed">
          For research reference only. Not for clinical decisions.
        </p>
      </div>
    </aside>
  )
}
