import React from 'react';

export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="w-8 h-8 border-3 border-lime-400/30 border-t-lime-400 rounded-full animate-spin"></div>
    </div>
  );
}
