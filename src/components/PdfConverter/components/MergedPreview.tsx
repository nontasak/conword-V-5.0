import React from 'react';
import { X, Download } from 'lucide-react';
import saveAs from 'file-saver';

interface MergedPreviewProps {
  blob: Blob | null;
  onClose: () => void;
  fileName: string;
}

const MergedPreview: React.FC<MergedPreviewProps> = ({ blob, onClose, fileName }) => {
  if (!blob) return null;
  const imageUrl = URL.createObjectURL(blob);

  const handleDownload = () => saveAs(blob, `${fileName}-merged.jpg`);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-white z-10">
          <h3 className="text-lg font-semibold text-slate-800">Merged Image Preview</h3>
          <div className="flex items-center gap-2">
            <button onClick={handleDownload} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <Download size={16} /> Download Image
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              <X size={24} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-slate-100 p-4 flex justify-center">
            <div className="shadow-lg">
                <img src={imageUrl} alt="Merged Result" className="max-w-full h-auto block bg-white" />
            </div>
        </div>
        <div className="p-3 bg-white border-t border-slate-100 text-center text-xs text-slate-500">
           Showing stitched image with auto-trimmed whitespace.
        </div>
      </div>
    </div>
  );
};

export default MergedPreview;
