import React, { useState, useEffect, useMemo } from 'react';
import { History, Trash2, RotateCcw, Copy, Check, Clock, FileText, AlertCircle, X, ChevronDown, Search, MoreVertical } from 'lucide-react';
import { TextSnapshot, getAllSnapshots, deleteSnapshot, clearAllSnapshots, getLastDeletedText } from '../utils/persistentStorage';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestore: (text: string) => void;
  currentText: string;
}

// Format Thai Date & Time e.g. "24 สิงหาคม เวลา 12:11 น."
function formatThaiDateTimeDisplay(date: Date): string {
  const day = date.getDate();
  const months = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  const monthName = months[date.getMonth()];
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${day} ${monthName} เวลา ${hours}:${minutes}:${seconds} น.`;
}

// Group snapshots by Date Period (วันนี้, เมื่อวานนี้, วันในสัปดาห์, เดือนนี้, etc.)
function getGroupLabel(date: Date, now: Date): string {
  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (isSameDay(date, now)) {
    return 'วันนี้';
  } else if (isSameDay(date, yesterday)) {
    return 'เมื่อวานนี้';
  } else {
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const dayNames = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
    const months = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];

    if (diffDays < 7) {
      return `${dayNames[date.getDay()]} (${date.getDate()} ${months[date.getMonth()]})`;
    } else if (date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()) {
      return `เดือนนี้ (${date.getDate()} ${months[date.getMonth()]})`;
    } else {
      return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear() + 543}`;
    }
  }
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  onRestore,
}) => {
  const [snapshots, setSnapshots] = useState<TextSnapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<TextSnapshot | null>(null);
  const [lastDeleted, setLastDeleted] = useState<{ text: string; deletedAt: string } | null>(null);
  const [copiedId, setCopiedId] = useState<number | 'deleted' | null>(null);
  const [isConfirmingClearAll, setIsConfirmingClearAll] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'today' | 'substantial'>('all');
  const [searchQuery, setSearchQuery] = useState('');

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

  // Group and filter snapshots
  const groupedSnapshots = useMemo(() => {
    const now = new Date();
    let filtered = snapshots;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) => s.text.toLowerCase().includes(q) || s.thaiTime.includes(q)
      );
    }

    if (filterType === 'today') {
      filtered = filtered.filter((s) => {
        const d = s.timestamp ? new Date(s.timestamp) : new Date(s.id);
        return (
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth() &&
          d.getDate() === now.getDate()
        );
      });
    } else if (filterType === 'substantial') {
      filtered = filtered.filter((s) => s.length > 100);
    }

    // Grouping
    const groups: { label: string; items: { snapshot: TextSnapshot; isLatest: boolean }[] }[] = [];
    const groupMap = new Map<string, { snapshot: TextSnapshot; isLatest: boolean }[]>();

    filtered.forEach((item, index) => {
      const itemDate = item.timestamp ? new Date(item.timestamp) : new Date(item.id);
      const label = getGroupLabel(itemDate, now);
      const isLatest = index === 0 && filterType === 'all' && !searchQuery.trim();

      if (!groupMap.has(label)) {
        groupMap.set(label, []);
        groups.push({ label, items: groupMap.get(label)! });
      }
      groupMap.get(label)!.push({ snapshot: item, isLatest });
    });

    return groups;
  }, [snapshots, filterType, searchQuery]);

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        id="history-modal-content"
        className="flex h-[88vh] max-h-[850px] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50/90 px-6 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600 shadow-xs">
              <History size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-800">
                ประวัติเวอร์ชัน (Version History)
              </h2>
              <p className="text-xs text-gray-500">
                บันทึกสำเนาอัตโนมัติในเครื่อง (IndexedDB) ป้องกันข้อมูลสูญหาย
              </p>
            </div>
          </div>
          <button
            id="close-history-modal-btn"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Main Body */}
        <div className="grid flex-1 min-h-0 grid-cols-1 overflow-hidden md:grid-cols-12">
          {/* Left Column: Version History Sidebar */}
          <div className="flex flex-col h-full min-h-0 overflow-hidden border-b border-gray-200 bg-[#f8f9fa] md:col-span-5 md:border-r md:border-b-0">
            {/* Last Deleted / Trash Recovery Banner */}
            {lastDeleted && (
              <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
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
                    className="flex shrink-0 items-center gap-1 rounded bg-amber-600 px-2 py-1 text-xs font-medium text-white shadow-xs hover:bg-amber-700 transition-colors"
                  >
                    <RotateCcw size={12} />
                    กู้คืน
                  </button>
                </div>
              </div>
            )}

            {/* Filter Dropdown & Search Bar (Google Docs Style) */}
            <div className="shrink-0 border-b border-gray-200 bg-white p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="relative flex-1">
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value as any)}
                    className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 pr-8 text-xs font-medium text-gray-700 hover:border-gray-400 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="all">ทุกเวอร์ชัน ({snapshots.length})</option>
                    <option value="today">เฉพาะวันนี้</option>
                    <option value="substantial">เฉพาะที่มีเนื้อหาเยอะ (&gt; 100 ตัวอักษร)</option>
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                </div>

                {snapshots.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="shrink-0 rounded px-2 py-1.5 text-xs text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors font-medium"
                    title="ล้างประวัติทั้งหมด"
                  >
                    {isConfirmingClearAll ? 'ยืนยันลบทั้งหมด?' : 'ล้างประวัติ'}
                  </button>
                )}
              </div>

              {/* Quick Search */}
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ค้นหาคำในประวัติ..."
                  className="w-full rounded-md border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-3 text-xs text-gray-800 placeholder-gray-400 focus:border-blue-500 focus:bg-white focus:outline-hidden"
                />
              </div>
            </div>

            {/* Snapshots Scrollable List with Custom Scrollbar */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3 space-y-4">
              {snapshots.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center text-gray-400">
                  <Clock size={36} className="mb-2 opacity-40" />
                  <p className="text-sm font-medium">ยังไม่มีประวัติการบันทึก</p>
                  <p className="mt-1 text-xs text-gray-400">เมื่อเริ่มพิมพ์ข้อความ ระบบจะทยอยเก็บประวัติให้อัตโนมัติ</p>
                </div>
              ) : groupedSnapshots.length === 0 ? (
                <div className="p-6 text-center text-xs text-gray-400">
                  ไม่พบรายการประวัติที่ตรงกับเงื่อนไขการค้นหา
                </div>
              ) : (
                groupedSnapshots.map((group) => (
                  <div key={group.label} className="space-y-1.5">
                    {/* Period Group Header e.g. "วันนี้", "เมื่อวานนี้", "วันพฤหัสบดี" */}
                    <div className="px-1 text-xs font-semibold text-gray-500 tracking-wide">
                      {group.label}
                    </div>

                    {/* Version Items */}
                    <div className="space-y-1">
                      {group.items.map(({ snapshot, isLatest }) => {
                        const isSelected = selectedSnapshot?.id === snapshot.id;
                        const dateObj = snapshot.timestamp
                          ? new Date(snapshot.timestamp)
                          : new Date(snapshot.id);
                        const formattedDisplay = formatThaiDateTimeDisplay(dateObj);

                        return (
                          <div
                            key={snapshot.id}
                            onClick={() => setSelectedSnapshot(snapshot)}
                            className={`group relative flex flex-col rounded-xl p-3 cursor-pointer transition-all duration-150 ${
                              isSelected
                                ? 'bg-[#e2e7ec] shadow-xs ring-1 ring-gray-300'
                                : 'hover:bg-gray-200/60'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              {/* Date & Time Header */}
                              <div className="flex-1">
                                <div className="text-xs font-bold text-gray-800 leading-snug">
                                  {formattedDisplay}
                                </div>

                                {/* Current Version Tag */}
                                {isLatest && (
                                  <div className="mt-1 text-[11px] font-medium text-gray-600">
                                    เวอร์ชันปัจจุบัน
                                  </div>
                                )}

                                {/* Subtitle info: Status dot & word/char counts */}
                                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-gray-600">
                                  <span className="h-2 w-2 rounded-full bg-teal-600 shrink-0" />
                                  <span>บันทึกอัตโนมัติ</span>
                                  <span>•</span>
                                  <span>{snapshot.length.toLocaleString()} ตัวอักษร</span>
                                </div>
                              </div>

                              {/* Delete Action Button */}
                              <button
                                onClick={(e) => handleDelete(snapshot.id, e)}
                                className="opacity-60 hover:opacity-100 p-1 text-gray-400 hover:text-red-600 rounded-md hover:bg-white/80 transition-all"
                                title="ลบรายการนี้"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>

                            {/* Short preview snippet if unselected */}
                            {!isSelected && (
                              <p className="mt-1.5 line-clamp-1 text-[11px] text-gray-400">
                                {snapshot.preview}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Column: Preview & Restore Actions */}
          <div className="flex flex-col h-full min-h-0 overflow-hidden bg-gray-50/40 md:col-span-7">
            {selectedSnapshot ? (
              <>
                <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-6 py-3.5 shadow-2xs">
                  <div>
                    <div className="text-xs font-bold text-gray-800">
                      ฉบับบันทึกเวลา: {selectedSnapshot.thaiTime}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      ความยาว: <span className="font-semibold text-gray-700">{selectedSnapshot.length.toLocaleString()}</span> ตัวอักษร (<span className="font-semibold text-gray-700">{selectedSnapshot.wordCount.toLocaleString()}</span> คำ)
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(selectedSnapshot.text, selectedSnapshot.id)}
                      className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 shadow-2xs transition-colors"
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
                      className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-blue-700 transition-colors"
                    >
                      <RotateCcw size={14} />
                      นำข้อความนี้กลับมาใช้
                    </button>
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-6">
                  <div className="min-h-full rounded-xl border border-gray-200 bg-white p-5 font-sans text-sm leading-relaxed whitespace-pre-wrap text-gray-800 shadow-xs">
                    {selectedSnapshot.text}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-8 text-center text-gray-400">
                <div>
                  <FileText size={40} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-medium">เลือกรายการด้านซ้ายเพื่อดูเนื้อหาตัวอย่าง</p>
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
            className="rounded-lg border border-gray-300 bg-white px-3.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};
