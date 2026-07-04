import React from 'react'
import { SourceCard as SourceCardType } from '../../shared/types'

const TYPE_CHIP_CLASS: Record<string, string> = {
  PubMed: 'chip-source chip-source--pubmed',
  UniProt: 'chip-source chip-source--uniprot',
  Ensembl: 'chip-source chip-source--ensembl',
  Reactome: 'chip-source chip-source--reactome'
}

interface Props {
  source: SourceCardType
}

export function SourceCard({ source }: Props) {
  return (
    <div className="p-4 bg-surface-raised border border-border rounded-md flex flex-col justify-between hover:border-border-strong transition-colors duration-150 group">
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4 className="text-xs font-medium text-slate-300 line-clamp-2 leading-snug group-hover:text-slate-100 transition-colors">
            {source.title}
          </h4>
          <span className={`${TYPE_CHIP_CLASS[source.type] || 'chip-source'} whitespace-nowrap flex-shrink-0`}>
            {source.type}
          </span>
        </div>
        <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed mb-3">
          {source.snippet}
        </p>
      </div>
      <div className="flex items-center justify-between pt-2.5 border-t border-border">
        {source.date ? (
          <span className="text-[9px] text-slate-600 font-medium">{source.date}</span>
        ) : (
          <span className="text-[9px] text-slate-700 font-medium">Ref</span>
        )}
        <button
          onClick={() => window.api.openExternal(source.url)}
          className="text-[10px] font-medium text-accent-indigo/80 hover:text-accent-indigo flex items-center gap-1 transition-colors group/btn"
        >
          View
          <svg className="w-3 h-3 transition-transform group-hover/btn:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
          </svg>
        </button>
      </div>
    </div>
  )
}
