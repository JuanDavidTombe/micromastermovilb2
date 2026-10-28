import React from 'react';

export default function Modal({ isOpen, onClose, title, children, footer }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden animate-slide-up">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 shrink-0">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate pr-2">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 shrink-0 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors"
            title="Cerrar modal"
            aria-label="Cerrar modal"
          >
            <i className="bi bi-x-lg text-xs" aria-hidden="true" />
          </button>
        </div>
        <div className="p-4 sm:p-5 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="p-3.5 sm:p-5 border-t border-slate-100 flex justify-end gap-2 sm:gap-3 shrink-0 bg-slate-50/50">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
