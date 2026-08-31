import React, { useState, useEffect } from 'react';
import { ReactSortable } from 'react-sortablejs';
import { Plus, Trash2, Edit, GripHorizontal, Search, X, MoreHorizontal, Check } from 'lucide-react';

interface ClipboardItem {
  id: string;
  text: string;
}

interface ClipboardProps {
  onPaste: (text: string) => void;
  height: number;
  storageKey?: string;
  title?: string;
  headerExtra?: React.ReactNode;
  itemFontSize?: number;
}

export const Clipboard: React.FC<ClipboardProps> = ({ onPaste, height, storageKey = 'clipList', title = 'Clipboard', headerExtra, itemFontSize }) => {
  const [items, setItems] = useState<ClipboardItem[]>([]);
  const [editingItem, setEditingItem] = useState<ClipboardItem | null>(null);
  const [editText, setEditText] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newItemText, setNewItemText] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [isConfirmingClear, setIsConfirmingClear] = useState(false);

  const [displayTitle, setDisplayTitle] = useState(title);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Close see-more dropdown menu on click outside
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.clipboard-seemore-container')) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

  // Load from local storage on mount
  useEffect(() => {
    const savedItems = localStorage.getItem(storageKey);
    if (savedItems) {
      try {
        const parsed = JSON.parse(savedItems);
        const formattedItems = parsed.map((item: any, index: number) => {
           if (typeof item === 'string') {
             return { id: `item-${Date.now()}-${index}`, text: item };
           }
           return item;
        });
        setItems(formattedItems);
      } catch (e) {
        console.error("Failed to parse clipboard items", e);
      }
    }
    
    const savedTitle = localStorage.getItem(`${storageKey}_title`);
    if (savedTitle) {
      setDisplayTitle(savedTitle);
    } else {
      setDisplayTitle(title);
    }

    setIsLoaded(true);
  }, [storageKey, title]);

  const handleTitleSave = () => {
    localStorage.setItem(`${storageKey}_title`, displayTitle);
    setIsEditingTitle(false);
  };

  // Save to local storage whenever items change, but only after initial load
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(storageKey, JSON.stringify(items));
    }
  }, [items, isLoaded, storageKey]);

  // Listen for external updates (e.g., from Context Menu or Selection Toolbar)
  useEffect(() => {
    const handleExternalUpdate = (e?: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent && customEvent.detail && customEvent.detail.storageKey && customEvent.detail.storageKey !== storageKey) {
        return;
      }

      const savedItems = localStorage.getItem(storageKey);
      if (savedItems) {
        try {
          const parsed = JSON.parse(savedItems);
          const formattedItems = parsed.map((item: any, index: number) => {
             if (typeof item === 'string') {
               return { id: `item-${Date.now()}-${index}`, text: item };
             }
             return item;
          });
          setItems(formattedItems);
        } catch (e) {
          console.error("Failed to parse clipboard items", e);
        }
      } else {
        setItems([]);
      }
    };

    const specificEventName = `clipboard-update-${storageKey}`;
    window.addEventListener('clipboard-updated', handleExternalUpdate);
    window.addEventListener(specificEventName, handleExternalUpdate);
    window.addEventListener('storage', handleExternalUpdate);

    return () => {
      window.removeEventListener('clipboard-updated', handleExternalUpdate);
      window.removeEventListener(specificEventName, handleExternalUpdate);
      window.removeEventListener('storage', handleExternalUpdate);
    };
  }, [storageKey]);

  const handleAddItemClick = () => {
    setIsAdding(true);
  };

  const saveNewItem = () => {
    if (newItemText.trim()) {
      // Split by newlines and add each non-empty line as a separate item
      const lines = newItemText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      if (lines.length > 0) {
        const newItems: ClipboardItem[] = lines.map((line, idx) => ({
          id: `item-${Date.now()}-${idx}`,
          text: line
        }));
        setItems(prev => [...prev, ...newItems]);
      }
      setNewItemText('');
      setIsAdding(false);
    }
  };

  const cancelAddItem = () => {
    setIsAdding(false);
    setNewItemText('');
  };

  const clearAll = () => {
    if (isConfirmingClear) {
      setItems([]);
      localStorage.removeItem(storageKey);
      setIsConfirmingClear(false);
    } else {
      setIsConfirmingClear(true);
      setTimeout(() => setIsConfirmingClear(false), 3000);
    }
  };

  const deleteItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const openEditModal = (item: ClipboardItem) => {
    setEditingItem(item);
    setEditText(item.text);
    setOpenMenuId(null);
  };

  const saveEdit = () => {
    if (editingItem && editText.trim()) {
      setItems(prev => prev.map(item => 
        item.id === editingItem.id ? { ...item, text: editText.trim() } : item
      ));
    }
    setEditingItem(null);
    setEditText('');
  };

  const filteredItems = items.filter(item => 
    item.text.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderItemContent = (item: ClipboardItem, index: number) => (
    <>
      <span className="index-number">
        {index + 1}.
      </span>

      <div className="clipboard-item-box">
        {/* Grip Handle */}
        <button className="drag-handle" style={{ cursor: searchTerm ? 'default' : 'move', opacity: searchTerm ? 0.3 : 1 }}>
          <GripHorizontal size={14} />
        </button>
        
        {/* Item Text with Ellipsis */}
        <span 
          className="item-text"
          style={{ fontSize: itemFontSize ? `${itemFontSize}px` : undefined }}
          onClick={() => onPaste(item.text)} 
          onMouseDown={(e) => e.preventDefault()}
          title={item.text}
        >
          {item.text}
        </span>

        {/* 3-dots horizontal See More Button at top-right */}
        <div className="clipboard-seemore-container">
          <button 
            type="button"
            className="seemore-btn" 
            onClick={(e) => {
              e.stopPropagation();
              setOpenMenuId(openMenuId === item.id ? null : item.id);
            }} 
            title="ตัวเลือกเพิ่มเติม"
          >
            <MoreHorizontal size={13} />
          </button>

          {openMenuId === item.id && (
            <div 
              className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl py-1 z-[90] min-w-[100px] text-xs animate-in fade-in zoom-in-95 duration-100"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => openEditModal(item)}
                className="w-full text-left px-3 py-1.5 hover:bg-blue-50 text-gray-700 hover:text-blue-600 flex items-center gap-1.5 transition-colors font-medium"
              >
                <Edit size={12} className="text-blue-500" />
                แก้ไข
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpenMenuId(null);
                  deleteItem(item.id);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-gray-700 hover:text-red-600 flex items-center gap-1.5 transition-colors font-medium border-t border-gray-100"
              >
                <Trash2 size={12} className="text-red-500" />
                ลบ
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );

  return (
    <>
      <div className="clipboard-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {isEditingTitle ? (
            <input
              value={displayTitle}
              onChange={(e) => setDisplayTitle(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTitleSave();
              }}
              autoFocus
              style={{ 
                fontSize: '1.17em', 
                fontWeight: 'bold', 
                border: '1px solid #ccc', 
                borderRadius: '4px', 
                padding: '2px',
                width: '150px',
                marginBottom: 0
              }}
            />
          ) : (
            <h3 
              id="clipboard-heading" 
              style={{ marginBottom: 0, cursor: 'pointer' }}
              onDoubleClick={() => setIsEditingTitle(true)}
              title="Double click to edit title"
            >
              {displayTitle}
            </h3>
          )}
          {headerExtra}
        </div>
        <div id="clipboard-buttons" style={{ display: 'flex', alignItems: 'center' }}>
          <button className="action-btn" onClick={handleAddItemClick}><Plus size={14} /></button>
          <button 
            className="action-btn" 
            onClick={clearAll}
            style={{ backgroundColor: isConfirmingClear ? '#ff4444' : '' }}
            title={isConfirmingClear ? "กดอีกครั้งเพื่อยืนยัน" : "ล้างรายการทั้งหมด"}
          >
            {isConfirmingClear ? 'ยืนยัน?' : <Trash2 size={14} />}
          </button>
          
          <div style={{ position: 'relative', flexGrow: 1, marginLeft: '10px' }}>
            <Search size={14} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: '#888' }} />
            <input
              type="text"
              placeholder="ค้นหา..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '5px 28px 5px 28px',
                borderRadius: '15px',
                border: '1px solid #ddd',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  color: '#888',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="ล้างคำค้นหา"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Add Item Modal */}
      {isAdding && (
        <div 
          className="fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(1px)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              cancelAddItem();
            }
          }}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-lg sm:max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200 shrink-0">
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <Plus size={16} className="text-blue-600 shrink-0" />
                <h3 className="font-bold text-gray-800 text-sm truncate">
                  เพิ่มข้อความใน {displayTitle}
                </h3>
              </div>
              <button 
                onClick={cancelAddItem}
                className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-200 transition-colors shrink-0"
                title="ปิด"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-2 flex-1 flex flex-col min-h-0">
              <textarea
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                placeholder="ใส่ข้อความที่นี่... (ขึ้นบรรทัดใหม่เพื่อแยกหลายรายการ)"
                className="w-full h-[400px] sm:h-[480px] max-h-[65vh] p-3.5 text-base font-medium text-gray-800 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y leading-relaxed"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    saveNewItem();
                  }
                }}
              />
              <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1 shrink-0">
                <span>แยก 1 รายการต่อ 1 บรรทัด</span>
                <span>กด Ctrl + Enter เพื่อบันทึกด่วน</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-4 py-2.5 bg-gray-50 border-t border-gray-200 shrink-0">
              <button
                type="button"
                onClick={cancelAddItem}
                className="px-3.5 py-1.5 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-md transition-colors font-medium"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={saveNewItem}
                disabled={!newItemText.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md text-xs font-semibold shadow-xs transition-colors"
              >
                <Check size={14} />
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}

      {searchTerm ? (
        <ul className="clip-list" style={{ overflowY: 'auto', flexGrow: 1 }}>
          {filteredItems.map((item, index) => (
            <li key={item.id}>
              {renderItemContent(item, index)}
            </li>
          ))}
        </ul>
      ) : (
        <ReactSortable 
          list={items} 
          setList={setItems}
          handle=".drag-handle"
          tag="ul"
          className="clip-list"
          animation={150}
          group="shared-clipboard"
        >
          {items.map((item, index) => (
            <li key={item.id}>
              {renderItemContent(item, index)}
            </li>
          ))}
        </ReactSortable>
      )}

      {/* Edit Item Modal */}
      {editingItem && (
        <div 
          className="fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(1px)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setEditingItem(null);
              setEditText('');
            }
          }}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150 select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Edit size={16} className="text-blue-600" />
                <h3 className="font-bold text-gray-800 text-sm">แก้ไขข้อความคลิปบอร์ด</h3>
              </div>
              <button 
                onClick={() => {
                  setEditingItem(null);
                  setEditText('');
                }}
                className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-200 transition-colors"
                title="ปิด"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-3.5 space-y-2">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                placeholder="ระบุข้อความ..."
                rows={2}
                className="w-full min-h-[52px] max-h-[140px] p-2.5 text-base sm:text-lg font-medium text-gray-800 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y leading-snug"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    saveEdit();
                  }
                }}
              />
              <p className="text-[11px] text-gray-400 text-right">กด Ctrl + Enter เพื่อบันทึกด่วน</p>
            </div>

            <div className="flex items-center justify-end gap-2 px-4 py-2 bg-gray-50 border-t border-gray-200">
              <button
                type="button"
                onClick={() => {
                  setEditingItem(null);
                  setEditText('');
                }}
                className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-md transition-colors font-medium"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={saveEdit}
                className="flex items-center gap-1 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-semibold shadow-xs transition-colors"
              >
                <Check size={14} />
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
