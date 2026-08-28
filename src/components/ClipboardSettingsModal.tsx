import React from 'react';
import { X, SlidersHorizontal, RotateCcw, Minus, Plus, Check } from 'lucide-react';

interface ClipboardSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  width: number;
  onWidthChange: (width: number) => void;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  onReset: () => void;
}

export const ClipboardSettingsModal: React.FC<ClipboardSettingsModalProps> = ({
  isOpen,
  onClose,
  width,
  onWidthChange,
  fontSize,
  onFontSizeChange,
  onReset,
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[120] flex items-center justify-center p-3 pointer-events-auto"
      style={{ backgroundColor: 'transparent' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-gray-300 w-full max-w-[320px] overflow-hidden animate-in fade-in zoom-in-95 duration-150 select-none ring-1 ring-black/5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-3.5 py-2.5 bg-gray-100/80 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={15} className="text-blue-600" />
            <h3 className="font-bold text-gray-800 text-sm leading-tight">ตั้งค่าคลิปบอร์ด</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-200 transition-colors"
            title="ปิดหน้าต่าง"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-3.5 space-y-4">
          
          {/* Section 1: Clipboard Width */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-700">ความกว้างของคลิปบอร์ด</span>
              <span className="font-mono font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                {width}px
              </span>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <span className="text-[10px] text-gray-400 font-mono">160</span>
              <input
                type="range"
                min="160"
                max="460"
                step="5"
                value={width}
                onChange={(e) => onWidthChange(Number(e.target.value))}
                className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 focus:outline-none"
              />
              <span className="text-[10px] text-gray-400 font-mono">460</span>
            </div>
          </div>

          <hr className="border-gray-200" />

          {/* Section 2: Clipboard Item Font Size */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-gray-700">ขนาดตัวอักษร</span>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center border border-gray-300 rounded-md bg-gray-50 overflow-hidden shadow-xs">
                <button
                  type="button"
                  onClick={() => onFontSizeChange(Math.max(10, fontSize - 1))}
                  className="px-2 py-1 hover:bg-gray-200 active:bg-gray-300 text-gray-600 transition-colors"
                  title="ลดขนาดตัวอักษร"
                >
                  <Minus size={13} />
                </button>
                
                <input
                  type="number"
                  min="10"
                  max="28"
                  value={fontSize}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (!isNaN(val) && val >= 8 && val <= 36) {
                      onFontSizeChange(val);
                    }
                  }}
                  className="w-12 text-center text-xs font-semibold font-mono bg-white border-x border-gray-300 py-1 text-gray-800 focus:outline-none focus:bg-blue-50/50"
                />

                <button
                  type="button"
                  onClick={() => onFontSizeChange(Math.min(28, fontSize + 1))}
                  className="px-2 py-1 hover:bg-gray-200 active:bg-gray-300 text-gray-600 transition-colors"
                  title="เพิ่มขนาดตัวอักษร"
                >
                  <Plus size={13} />
                </button>
              </div>

              <span className="text-[11px] text-gray-500 font-sans">พิกเซล (px)</span>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-3 py-2 bg-gray-100/80 border-t border-gray-200">
          <button
            type="button"
            onClick={onReset}
            className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-red-600 py-1 px-2 rounded hover:bg-gray-200 transition-colors"
            title="รีเซ็ตเป็นค่าเริ่มต้น"
          >
            <RotateCcw size={12} />
            คืนค่า
          </button>
          
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold shadow-xs transition-colors"
          >
            <Check size={13} />
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};
