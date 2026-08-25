import React, { useEffect, useRef } from 'react';
import { PanelLeft, PanelRight, ArrowDownToLine, ClipboardPaste } from 'lucide-react';

interface SelectionToolbarProps {
  selection: {
    text: string;
    x: number;
    y: number;
    start: number;
    end: number;
  };
  onClose: () => void;
  onAction: (action: 'add-left' | 'add-right' | 'insert-last' | 'paste') => void;
}

export const SelectionToolbar: React.FC<SelectionToolbarProps> = ({ selection, onClose, onAction }) => {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const hasHoveredRef = useRef(false);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (toolbarRef.current && toolbarRef.current.contains(e.target as Node)) {
        return;
      }
      onClose();
    };

    const handleScroll = () => {
      onClose();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (hasHoveredRef.current) return;

      if (toolbarRef.current) {
        const rect = toolbarRef.current.getBoundingClientRect();
        // Distance threshold: about 2 lines (roughly 60px from boundaries)
        const threshold = 60;
        
        if (
          e.clientX < rect.left - threshold ||
          e.clientX > rect.right + threshold ||
          e.clientY < rect.top - threshold ||
          e.clientY > rect.bottom + threshold
        ) {
          onClose();
        }
      }
    };

    // Use a small timeout to avoid closing immediately due to the click that triggered the selection
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handleOutsideClick);
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('keydown', onClose);
    }, 100);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('keydown', onClose);
    };
  }, [onClose]);

  const truncateText = (text: string, maxLength: number = 30) => {
    const lines = text.split('\n');
    let firstLine = lines[0].trim();
    if (firstLine.length > maxLength) {
      return firstLine.substring(0, maxLength) + '...';
    }
    if (lines.length > 1) {
      return firstLine + '...';
    }
    return firstLine;
  };

  return (
    <div
      ref={toolbarRef}
      id="selection-toolbar"
      onMouseEnter={() => { hasHoveredRef.current = true; }}
      style={{
        position: 'fixed',
        top: selection.y,
        left: selection.x,
        transform: 'translate(-50%, -100%)',
        marginTop: '-15px',
        zIndex: 9999,
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.2), 0 2px 5px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column',
        minWidth: '220px',
        maxWidth: '300px',
        overflow: 'hidden',
        border: '1px solid #e2e8f0',
        animation: 'toolbar-fade-in 0.2s ease-out'
      }}
    >
      <style>{`
        @keyframes toolbar-fade-in {
          from { opacity: 0; transform: translate(-50%, -90%); }
          to { opacity: 1; transform: translate(-50%, -100%); }
        }
        .toolbar-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          background: transparent;
          border: none;
          cursor: pointer;
          gap: 6px;
          padding: 10px 4px;
          flex: 1;
          transition: background 0.2s;
          border-radius: 8px;
        }
        .toolbar-btn:hover {
          background-color: #f1f5f9;
        }
        .toolbar-btn span {
          font-size: 11px;
          color: #475569;
          font-weight: 500;
          white-space: nowrap;
        }
        .toolbar-icon-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 8px;
        }
      `}</style>
      
      <div style={{ 
        padding: '8px 14px', 
        borderBottom: '1px solid #f1f5f9', 
        backgroundColor: '#f8fafc', 
        fontSize: '11px', 
        color: '#64748b', 
        textAlign: 'center',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }}>
        {truncateText(selection.text)}
      </div>
      
      <div style={{ display: 'flex', padding: '6px', gap: '2px' }}>
        <button className="toolbar-btn" onClick={() => onAction('add-left')}>
          <div className="toolbar-icon-wrapper" style={{ backgroundColor: '#eff6ff' }}>
            <PanelLeft size={18} color="#2563eb" />
          </div>
          <span>เพิ่มลงคลิปซ้าย</span>
        </button>

        <button className="toolbar-btn" onClick={() => onAction('add-right')}>
          <div className="toolbar-icon-wrapper" style={{ backgroundColor: '#eff6ff' }}>
            <PanelRight size={18} color="#2563eb" />
          </div>
          <span>เพิ่มลงคลิปขวา</span>
        </button>

        <button className="toolbar-btn" onClick={() => onAction('insert-last')}>
          <div className="toolbar-icon-wrapper" style={{ backgroundColor: '#f0fdf4' }}>
            <ArrowDownToLine size={18} color="#16a34a" />
          </div>
          <span>แทรกข้อความ</span>
        </button>

        <button className="toolbar-btn" onClick={() => onAction('paste')}>
          <div className="toolbar-icon-wrapper" style={{ backgroundColor: '#fff7ed' }}>
            <ClipboardPaste size={18} color="#ea580c" />
          </div>
          <span>วาง</span>
        </button>
      </div>
    </div>
  );
};
