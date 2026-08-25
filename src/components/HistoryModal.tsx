import React, { useState, useEffect } from 'react';
import { History, Trash2, RotateCcw, Copy, Check, Clock, FileText, AlertCircle, X } from 'lucide-react';
import { TextSnapshot, getAllSnapshots, deleteSnapshot, clearAllSnapshots, getLastDeletedText } from '../utils/persistentStorage';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestore: (text: string) => void;
  currentText: string;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  onRestore,
  currentText,
}) => {
  const [snapshots, setSnapshots] = useState<TextSnapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<TextSnapshot | null>(null);
  const [lastDeleted, setLastDeleted] = useState<{ text: string; deletedAt: string } | null>(null);
  const [copiedId, setCopiedId] = useState<number | 'deleted' | null>(null);
  const [isConfirmingClearAll, setIsConfirmingClearAll] = useState(false);

  const loadData = async () => {
    const list = await getAllSnapshots();
    setSnapshots(list);
    if (list.length > 0) {
      setSelectedSnapshot(list[0]);
    } else {
      setSelectedSnapshot(null);
    }
    const deleted = await getLastDeletedText();
    setLastDeleted(deleted);
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopy = async (text: string, id: number | 'deleted') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      console.error('Failed to copy', e);
    }
  };

  const handleRestore = (text: string) => {
    if (confirm('คุณต้องการนำข้อความนี้กลับมาใส่ในพื้นที่ทำงานใช่หรือไม่?')) {
      onRestore(text);
      onClose();
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteSnapshot(id);
    const updated = snapshots.filter((s) => s.id !== id);
    setSnapshots(updated);
    if (selectedSnapshot?.id === id) {
      setSelectedSnapshot(updated.length > 0 ? updated[0] : null);
    }
  };

  const handleClearAll = async () => {
    if (isConfirmingClearAll) {
      await clearAllSnapshots();
      setSnapshots([]);
      setSelectedSnapshot(null);
      setIsConfirmingClearAll(false);
    } else {
      setIsConfirmingClearAll(true);
      setTimeout(() => setIsConfirmingClearAll(false), 4000);
    }
  };

  return (
    <div
      id="history-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        id="history-modal-content"
        className="flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
              <History size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-800">
                ประวัติการบันทึกข้อความย้อนหลัง (Local Snapshot History)
              </h2>
              <p className="text-xs text-gray-500">
                ระบบจัดเก็บในเครื่องอัตโนมัติ (IndexedDB) ป้องกันข้อความสูญหาย แม้ไม่ได้เชื่อมต่ออินเทอร์เน็ต
              </p>
            </div>
          </div>
          <button
            id="close-history-modal-btn"
            onClick={onClose}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
          >
            <X size={18} />
          </button>
        </div>

        {/* Main Body */}
        <div className="grid flex-1 grid-cols-1 overflow-hidden md:grid-cols-12">
          {/* Left Column: Snapshot List */}
          <div className="flex flex-col border-b border-gray-200 md:col-span-5 md:border-r md:border-b-0">
            {/* Last Deleted / Trash Recovery Banner */}
            {lastDeleted && (
              <div className="border-b border-amber-200 bg-amber-50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-1.5">
                    <AlertCircle size={15} className="mt-0.5 shrink-0 text-amber-600" />
                    <div>
                      <div className="text-xs font-semibold text-amber-900">
                        ข้อความล่าสุดที่เพิ่งกดล้าง ({lastDeleted.deletedAt})
                      </div>
                      <div className="mt-0.5 line-clamp-1 text-xs text-amber-700">
                        {lastDeleted.text}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRestore(lastDeleted.text)}
                    className="flex shrink-0 items-center gap-1 rounded bg-amber-600 px-2 py-1 text-xs font-medium text-white shadow-xs hover:bg-amber-700"
                  >
                    <RotateCcw size={12} />
                    กู้คืน
                  </button>
                </div>
              </div>
            )}

            {/* List Header */}
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/70 px-4 py-2 text-xs font-medium text-gray-500">
              <span>รายการบันทึก ({snapshots.length})</span>
              {snapshots.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  {isConfirmingClearAll ? 'ยืนยันลบประวัติทั้งหมด?' : 'ล้างประวัติ'}
                </button>
              )}
            </div>

            {/* Snapshots Scrollable List */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {snapshots.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center text-gray-400">
                  <Clock size={32} className="mb-2 opacity-40" />
                  <p className="text-sm">ยังไม่มีประวัติการบันทึก</p>
                  <p className="mt-1 text-xs text-gray-400">เมื่อเริ่มพิมพ์ข้อความ ระบบจะทยอยเก็บประวัติให้อัตโนมัติ</p>
                </div>
              ) : (
                snapshots.map((item) => {
                  const isSelected = selectedSnapshot?.id === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedSnapshot(item)}
                      className={`cursor-pointer p-3 transition-colors ${
                        isSelected ? 'bg-blue-50/80 border-l-4 border-blue-500' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-700">
                          {item.thaiTime}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                            {item.length.toLocaleString()} ตัวอักษร
                          </span>
                          <button
                            onClick={(e) => handleDelete(item.id, e)}
                            className="p-1 text-gray-300 hover:text-red-500"
                            title="ลบรายการนี้"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                        {item.preview}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Preview & Restore Actions */}
          <div className="flex flex-col overflow-hidden bg-gray-50/30 md:col-span-7">
            {selectedSnapshot ? (
              <>
                <div className="flex items-center justify-between border-b border-gray-200 bg-white px-5 py-3">
                  <div>
                    <div className="text-xs font-semibold text-gray-800">
                      ฉบับบันทึกเวลา: {selectedSnapshot.thaiTime}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      ความยาว: {selectedSnapshot.length.toLocaleString()} ตัวอักษร ({selectedSnapshot.wordCount.toLocaleString()} คำ)
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(selectedSnapshot.text, selectedSnapshot.id)}
                      className="flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      {copiedId === selectedSnapshot.id ? (
                        <>
                          <Check size={14} className="text-green-600" />
                          คัดลอกแล้ว
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          คัดลอก
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleRestore(selectedSnapshot.text)}
                      className="flex items-center gap-1 rounded-md bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-blue-700"
                    >
                      <RotateCcw size={14} />
                      นำข้อความนี้กลับมาใช้
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                  <div className="min-h-full rounded-lg border border-gray-200 bg-white p-4 font-sans text-sm leading-relaxed whitespace-pre-wrap text-gray-800 shadow-xs">
                    {selectedSnapshot.text}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-8 text-center text-gray-400">
                <div>
                  <FileText size={40} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">เลือกรายการด้านซ้ายเพื่อดูเนื้อหาตัวอย่าง</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-2.5 text-xs text-gray-500">
          <span>💡 ข้อมูลทั้งหมดถูกจัดเก็บอยู่ในเครื่องนี้เท่านั้น ไม่ได้ส่งขึ้นเซิร์ฟเวอร์หรือฐานข้อมูลภายนอก</span>
          <button
            onClick={onClose}
            className="rounded border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};
