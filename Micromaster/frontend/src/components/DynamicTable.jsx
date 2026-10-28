import React from 'react';

export default function DynamicTable({ columns, data, renderRow, rowClassName, className = '' }) {
  return (
    <div className={`bg-white/80 rounded-2xl sm:rounded-3xl border border-slate-200 overflow-hidden shadow-sm ${className}`}>
      <div className="overflow-x-auto overscroll-x-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
        <table className="w-full text-left border-collapse sm:min-w-full">
          <thead>
            <tr className="bg-slate-900/5 border-b border-slate-100">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-2.5 sm:px-3 py-2 sm:py-2.5 text-[10px] sm:text-[11px] uppercase tracking-[0.1em] text-slate-500 font-bold whitespace-nowrap"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
            {(Array.isArray(data) ? data : []).map((row, idx) => (
              <tr key={row.id || idx} className={`hover:bg-white/60 transition-colors ${rowClassName ? rowClassName(row, idx) : ''}`}>
                {renderRow(row, idx)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
