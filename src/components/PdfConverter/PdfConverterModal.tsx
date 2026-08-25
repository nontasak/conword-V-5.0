import React, { useState, useCallback, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import saveAs from 'file-saver';
import { FileDown, Image as ImageIcon, Loader2, RefreshCw, X, CheckCircle2, Layers } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

import Dropzone from './components/Dropzone';
import ResultGrid from './components/ResultGrid';
import ProgressBar from './components/ProgressBar';
import MergedPreview from './components/MergedPreview';
import { getPDFDocument, renderPageToImage } from './utils/pdfWorker';
import { mergeImagesVertical } from './utils/imageMerger';
import { ProcessedPage, ConversionStatus } from './types';

interface PdfConverterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PdfConverterModal: React.FC<PdfConverterModalProps> = ({ isOpen, onClose }) => {
  const [status, setStatus] = useState<ConversionStatus>(ConversionStatus.IDLE);
  const [pages, setPages] = useState<ProcessedPage[]>([]);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [mergedBlob, setMergedBlob] = useState<Blob | null>(null);

  const objectUrlsRef = useRef<string[]>([]);

  const cleanupResources = useCallback(() => {
    objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];
  }, []);

  useEffect(() => {
    if (!isOpen) {
      reset();
    }
    return () => cleanupResources();
  }, [isOpen, cleanupResources]);

  const handleFileSelect = useCallback(async (file: File) => {
    cleanupResources();
    setCurrentFile(file);
    setStatus(ConversionStatus.PROCESSING);
    setPages([]);
    setError(null);
    setMergedBlob(null);
    setProgress({ current: 0, total: 0 });

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await getPDFDocument(arrayBuffer);
      const totalPages = pdf.numPages;

      setProgress({ current: 0, total: totalPages });

      for (let i = 1; i <= totalPages; i++) {
        try {
          const pageData = await renderPageToImage(pdf, i);
          objectUrlsRef.current.push(pageData.url);
          setPages(prev => [...prev, {
            pageNumber: i, imageUrl: pageData.url, blob: pageData.blob, width: pageData.width, height: pageData.height
          }]);
          setProgress(prev => ({ ...prev, current: i }));
        } catch (err) {
          console.error(`Error rendering page ${i}`, err);
        }
      }
      setStatus(ConversionStatus.COMPLETE);
    } catch (err) {
      console.error("PDF Load Error", err);
      setError("Failed to load PDF. It might be password protected or corrupted.");
      setStatus(ConversionStatus.ERROR);
    }
  }, [cleanupResources]);

  const handleDownloadPage = (page: ProcessedPage) => saveAs(page.blob, `page-${page.pageNumber}.jpg`);

  const handleDownloadAll = async () => {
    if (pages.length === 0) return;
    const zip = new JSZip();
    const folder = zip.folder("converted-images");
    pages.forEach(page => {
      if (folder) folder.file(`page-${page.pageNumber}.jpg`, page.blob);
    });
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, `${currentFile?.name.replace('.pdf', '') || 'document'}-images.zip`);
  };
  
  const handleMergeAll = async () => {
    if (pages.length === 0) return;
    setIsMerging(true);
    await new Promise(resolve => setTimeout(resolve, 100));
    try {
        const blob = await mergeImagesVertical(pages);
        setMergedBlob(blob);
    } catch (err) {
        console.error("Merge failed", err);
        alert(`Merge failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
        setIsMerging(false);
    }
  };

  const reset = () => {
    cleanupResources();
    setStatus(ConversionStatus.IDLE);
    setPages([]);
    setCurrentFile(null);
    setError(null);
    setMergedBlob(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden relative">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-50 bg-opacity-80 backdrop-blur-md">
          <div className="px-4 sm:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 p-2 rounded-lg text-white"><ImageIcon size={20} /></div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700">แปลง PDF เป็นรูปภาพ</h1>
            </div>
            <div className="flex items-center gap-4">
              {status !== ConversionStatus.IDLE && (
                <button onClick={reset} className="text-sm font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-slate-100 transition-colors">
                  <RefreshCw size={14} /> แปลงไฟล์ใหม่
                </button>
              )}
              <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <X size={24} />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-grow bg-slate-50 overflow-y-auto">
          <div className="px-4 sm:px-6 py-12">
            {status === ConversionStatus.IDLE && (
              <div className="flex flex-col items-center animate-fade-in-up">
                <div className="text-center mb-10">
                  <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">แปลงไฟล์ PDF เป็นรูปภาพ <span className="text-blue-600">ทันที</span></h2>
                  <p className="text-lg text-slate-500 max-w-2xl mx-auto">ฟรี ปลอดภัย และคุณภาพสูงในการแยกรูปภาพจากเอกสาร PDF ของคุณ ทุกอย่างทำงานบนเบราว์เซอร์ของคุณ ไม่มีการอัปโหลดไฟล์</p>
                </div>
                <Dropzone onFileSelect={handleFileSelect} status={status} />
              </div>
            )}

            {status === ConversionStatus.PROCESSING && (
              <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <Loader2 className="animate-spin text-blue-600 mb-6" size={48} />
                <ProgressBar progress={progress.current} total={progress.total} />
              </div>
            )}

            {status === ConversionStatus.ERROR && (
               <div className="flex flex-col items-center justify-center min-h-[40vh]">
                 <div className="p-4 bg-red-50 text-red-700 rounded-full mb-4"><X size={32} /></div>
                 <h3 className="text-xl font-semibold text-slate-800 mb-2">เกิดข้อผิดพลาด</h3>
                 <p className="text-slate-500 mb-6">{error}</p>
                 <button onClick={reset} className="px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors font-medium">ลองอีกครั้ง</button>
               </div>
            )}

            {status === ConversionStatus.COMPLETE && (
              <div className="animate-fade-in">
                 <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                   <div className="flex items-center gap-3">
                     <div className="bg-green-100 text-green-600 p-2 rounded-full"><CheckCircle2 size={24} /></div>
                     <div>
                       <h3 className="font-semibold text-slate-900">{currentFile?.name}</h3>
                       <p className="text-sm text-slate-500">แปลงสำเร็จ {pages.length} หน้า</p>
                     </div>
                   </div>
                   <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                     <button onClick={handleMergeAll} disabled={isMerging} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-lg font-medium transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
                       {isMerging ? <Loader2 className="animate-spin" size={18} /> : <Layers size={18} />} ต่อภาพทั้งหมดแนวตั้ง
                     </button>
                     <button onClick={handleDownloadAll} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition-all shadow-md active:scale-95">
                       <FileDown size={18} /> ดาวน์โหลด ZIP
                     </button>
                   </div>
                 </div>
                 <ResultGrid pages={pages} onDownloadPage={handleDownloadPage} />
              </div>
            )}
          </div>
        </main>

        {mergedBlob && (
          <MergedPreview blob={mergedBlob} onClose={() => setMergedBlob(null)} fileName={currentFile?.name.replace('.pdf', '') || 'document'} />
        )}
      </div>
    </div>
  );
};
