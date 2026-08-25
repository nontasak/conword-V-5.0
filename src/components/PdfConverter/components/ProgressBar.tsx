import React from 'react';

interface ProgressBarProps {
  progress: number;
  total: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress, total }) => {
  const percentage = total > 0 ? Math.round((progress / total) * 100) : 0;

  return (
    <div className="w-full max-w-xl mx-auto mt-8 p-6 bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="flex justify-between items-end mb-2">
        <div>
           <h4 className="font-semibold text-slate-800">Processing Document...</h4>
           <p className="text-sm text-slate-500">Converting page {progress} of {total}</p>
        </div>
        <span className="text-2xl font-bold text-blue-600">{percentage}%</span>
      </div>
      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 transition-all duration-300 ease-out" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
};

export default ProgressBar;
