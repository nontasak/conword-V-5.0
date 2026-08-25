import React, { useRef, useState } from 'react';
import { Upload, FileType } from 'lucide-react';
import { ConversionStatus } from '../types';

interface DropzoneProps {
  onFileSelect: (file: File) => void;
  status: ConversionStatus;
}

const Dropzone: React.FC<DropzoneProps> = ({ onFileSelect, status }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) validateAndPassFile(e.dataTransfer.files[0]);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) validateAndPassFile(e.target.files[0]);
  };

  const validateAndPassFile = (file: File) => {
    if (file.type !== 'application/pdf') { alert('Please upload a valid PDF file.'); return; }
    onFileSelect(file);
  };

  const handleClick = () => inputRef.current?.click();
  const isProcessing = status === ConversionStatus.PROCESSING;

  return (
    <div
      onClick={!isProcessing ? handleClick : undefined}
      onDragOver={!isProcessing ? handleDragOver : undefined}
      onDragLeave={!isProcessing ? handleDragLeave : undefined}
      onDrop={!isProcessing ? handleDrop : undefined}
      className={`relative group cursor-pointer flex flex-col items-center justify-center w-full max-w-2xl mx-auto p-12 border-2 border-dashed rounded-2xl transition-all duration-300 ease-in-out ${isDragOver ? 'border-blue-500 bg-blue-50 scale-[1.02]' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'} ${isProcessing ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
    >
      <input type="file" ref={inputRef} onChange={handleFileInput} accept=".pdf" className="hidden" />
      <div className={`p-4 rounded-full mb-4 transition-colors duration-300 ${isDragOver ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500'}`}>
        <Upload size={48} />
      </div>
      <h3 className="text-xl font-semibold text-slate-700 mb-2 text-center">
        {isDragOver ? 'Drop PDF here' : 'Click or Drag & Drop PDF'}
      </h3>
      <p className="text-slate-500 text-sm text-center max-w-xs">
        Supports high-quality conversion. Your file is processed securely in your browser.
      </p>
      <div className="flex gap-3 mt-8 opacity-40">
        <div className="flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-200 px-2 py-1 rounded"><FileType size={12} /> PDF</div>
        <div className="text-slate-300">→</div>
        <div className="flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-200 px-2 py-1 rounded"><FileType size={12} /> JPG</div>
      </div>
    </div>
  );
};

export default Dropzone;
