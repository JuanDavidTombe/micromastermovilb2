import React from 'react';

export default function DynamicTable({ columns, data, renderRow, rowClassName, className = '' }) {
  return (
    <div className={`bg-white/80 rounded-3xl border border-slate-200 overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-900/5 border-b border-slate-100">
              {columns.map((col) => (
                <th key={col.key} className="px-4 py-3 text-left text-[10px] uppercase tracking-[0.15em] text-slate-500 font-semibold">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((row, idx) => (
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
