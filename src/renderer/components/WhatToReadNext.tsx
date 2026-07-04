import React from 'react'
import { Reading } from '../../shared/types'

interface Props {
  readings: Reading[]
}

export function WhatToReadNext({ readings }: Props) {
  if (readings.length === 0) return null

  return (
    <div className="section-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Recommended Reading
        </h3>
      </div>
      
      <ul className="space-y-2">
        {readings.map((reading, i) => (
          <li key={i} className="flex items-start gap-3 px-3 py-2.5 rounded hover:bg-surface-overlay/40 transition-colors duration-100">
            <span className="flex-shrink-0 w-5 h-5 bg-surface-overlay text-slate-500 rounded flex items-center justify-center text-[9px] font-semibold mt-0.5">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <button
                onClick={() => window.api.openExternal(reading.url)}
                className="text-xs font-medium text-accent-indigo/80 hover:text-accent-indigo text-left leading-snug transition-colors"
              >
                {reading.title}
              </button>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                {reading.reason}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
