import React, { useState } from 'react';
import { 
  AlertTriangle, 
  Download, 
  RotateCcw, 
  X, 
  FileText, 
  Clock, 
  CheckCircle2, 
  ShieldAlert, 
  Copy, 
  Check,
  HardDriveDownload
} from 'lucide-react';

export interface EmergencyBackupData {
  text: string;
  timestamp: number;
  thaiTime?: string;
  length: number;
  wordCount: number;
  source?: string;
}

interface EmergencyRecoveryModalProps {
  isOpen: boolean;
  backupData: EmergencyBackupData | null;
  onClose: () => void;
  onRestore: (text: string) => void;
}

export const EmergencyRecoveryModal: React.FC<EmergencyRecoveryModalProps> = ({
  isOpen,
  backupData,
  onClose,
  onRestore,
}) => {
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  if (!isOpen || !backupData || !backupData.text) {
    return null;
  }

  const { text, thaiTime, length, wordCount, timestamp } = backupData;

  // Format backup date/time
  const formattedTime = thaiTime || (() => {
    try {
      const d = new Date(timestamp || Date.now());
      return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
        ' น. (' + d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) + ')';
    } catch {
      return 'เมื่อสักครู่';
    }
  })();

  // 1. Primary Action: Download Emergency .txt File
  const handleDownloadTxt = () => {
    try {
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      const now = new Date();
      const dateStr = `${now.getFullYear() + 543}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
      
      link.href = url;
      link.download = `ฉุกเฉิน_กู้คืนข้อความ_${dateStr}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 4000);
    } catch (e) {
      console.error('Download failed', e);
      alert('ไม่สามารถดาวน์โหลดไฟล์ได้ กรุณาลองใช้ปุ่มคัดลอกหรือกู้คืนลงหน้าจอ');
    }
  };

  // 2. Secondary Action: Restore to screen
  const handleRestoreToScreen = () => {
    onRestore(text);
    onClose();
  };

  // Copy to clipboard helper
  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setCopied(false);
    }
  };

  const lineCount = text.split('\n').length;

  return (
    <div 
      id="emergency-recovery-modal-overlay"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      style={{ animationDuration: '200ms' }}
    >
      <div 
        id="emergency-recovery-modal-content"
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border-2 border-amber-400 dark:border-amber-500 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Modal Header with Warning Banner */}
        <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 text-white px-6 py-5 flex items-start justify-between relative overflow-hidden">
          <div className="flex items-center gap-3.5 z-10">
            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-md shadow-inner flex-shrink-0">
              <ShieldAlert className="w-7 h-7 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-white/25 text-white text-xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Data Loss Recovery
                </span>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-white mt-1">
                ระบบกู้คืนข้อมูลฉุกเฉิน
              </h2>
            </div>
          </div>

          <button
            id="btn-close-emergency-modal"
            onClick={onClose}
            className="text-white/80 hover:text-white p-2 rounded-lg hover:bg-white/10 transition-colors z-10"
            title="ปิดหน้าต่างนี้"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 bg-amber-50/30 dark:bg-slate-900/50">
          {/* Main Warning Box */}
          <div className="flex items-start gap-3.5 bg-amber-100/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-xl p-4 text-amber-900 dark:text-amber-200">
            <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-base leading-relaxed">
                ตรวจพบว่าข้อมูลในเครื่องถูกลบโดยระบบเบราว์เซอร์/OS!
              </p>
              <p className="text-sm text-amber-800 dark:text-amber-300/90 leading-relaxed">
                ระบบได้ดึงข้อมูลสำรองล่าสุดขึ้นมาให้แล้ว กรุณาบันทึกไฟล์เก็บลงเครื่องทันที เพื่อป้องกันข้อมูลสูญหาย
              </p>
            </div>
          </div>

          {/* Backup Metadata Badges */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1 mb-1">
                <Clock className="w-3.5 h-3.5 text-blue-500" /> เวลาที่สำรองล่าสุด
              </div>
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                {formattedTime}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1 mb-1">
                <FileText className="w-3.5 h-3.5 text-emerald-500" /> จำนวนตัวอักษร
              </div>
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {length.toLocaleString('th-TH')} ตัวอักษร
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                ขนาดเนื้อหา
              </div>
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {wordCount.toLocaleString('th-TH')} คำ ({lineCount} บรรทัด)
              </div>
            </div>
          </div>

          {/* Preview Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-amber-500" />
                ตัวอย่างข้อความที่กู้คืนได้:
              </label>
              <button
                id="btn-copy-recovered-text"
                onClick={handleCopyText}
                className="text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center gap-1 px-2.5 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" /> คัดลอกแล้ว
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> คัดลอกข้อความ
                  </>
                )}
              </button>
            </div>

            <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-300 dark:border-slate-700 p-3.5 max-h-56 overflow-y-auto font-mono text-sm leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre-wrap select-all shadow-inner">
              {text}
            </div>
          </div>
        </div>

        {/* Modal Action Buttons Footer */}
        <div className="px-6 py-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            id="btn-dismiss-emergency-modal"
            onClick={onClose}
            className="w-full sm:w-auto text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 px-3 py-2 rounded-lg transition-colors order-3 sm:order-1"
          >
            ไม่ต้องการกู้คืน (เริ่มหน้าว่างใหม่)
          </button>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end order-1 sm:order-2">
            {/* Button 2 (Secondary): Restore to Screen */}
            <button
              id="btn-restore-to-screen"
              onClick={handleRestoreToScreen}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-600 shadow-sm transition-all active:scale-[0.98]"
            >
              <RotateCcw className="w-4 h-4 text-blue-500" />
              กู้คืนลงหน้าจอ
            </button>

            {/* Button 1 (Primary): Download Emergency .txt File */}
            <button
              id="btn-download-emergency-txt"
              onClick={handleDownloadTxt}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-700 hover:to-orange-700 text-white font-semibold text-sm shadow-md hover:shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98]"
            >
              {downloaded ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-white animate-bounce" />
                  บันทึกไฟล์เรียบร้อยแล้ว!
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  ดาวน์โหลดไฟล์ฉุกเฉิน (.txt)
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
