import React from 'react';
import { Download, Eye } from 'lucide-react';
import { ProcessedPage } from '../types';

interface ResultGridProps {
  pages: ProcessedPage[];
  onDownloadPage: (page: ProcessedPage) => void;
}

const ResultGrid: React.FC<ResultGridProps> = ({ pages, onDownloadPage }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-4">
      {pages.map((page) => (
        <div key={page.pageNumber} className="group relative bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-all duration-300">
          <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10 flex justify-between items-start">
            <span className="text-white text-xs font-medium px-2 py-1 bg-black/40 backdrop-blur-sm rounded-md">Page {page.pageNumber}</span>
          </div>
          <div className="aspect-[3/4] w-full bg-slate-100 relative overflow-hidden flex items-center justify-center">
             <img src={page.imageUrl} alt={`Page ${page.pageNumber}`} className="w-full h-full object-contain" loading="lazy" />
             <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100 gap-2">
                <button onClick={() => window.open(page.imageUrl, '_blank')} className="p-2 bg-white text-slate-700 rounded-full shadow-lg hover:bg-slate-50 hover:text-blue-600 transition-transform hover:scale-105 active:scale-95" title="View Full Size">
                  <Eye size={20} />
                </button>
                <button onClick={() => onDownloadPage(page)} className="p-2 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-transform hover:scale-105 active:scale-95" title="Download Image">
                  <Download size={20} />
                </button>
             </div>
          </div>
          <div className="p-3 bg-white border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
             <span>{page.width} x {page.height}px</span>
             <span>{(page.blob.size / 1024).toFixed(1)} KB</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ResultGrid;
