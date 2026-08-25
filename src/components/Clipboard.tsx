import React, { useState, useEffect } from 'react';
import { ReactSortable } from 'react-sortablejs';
import { Plus, Trash2, Edit, GripHorizontal, Search, X } from 'lucide-react';

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
}

export const Clipboard: React.FC<ClipboardProps> = ({ onPaste, height, storageKey = 'clipList', title = 'Clipboard', headerExtra }) => {
  const [items, setItems] = useState<ClipboardItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newItemText, setNewItemText] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [isConfirmingClear, setIsConfirmingClear] = useState(false);

  const [displayTitle, setDisplayTitle] = useState(title);
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  // Load from local storage on mount
  useEffect(() => {
    const savedItems = localStorage.getItem(storageKey);
    if (savedItems) {
      try {
        const parsed = JSON.parse(savedItems);
        // Handle legacy array of strings or new object structure
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

  // Listen for external updates (e.g., from Context Menu)
  useEffect(() => {
    const handleExternalUpdate = () => {
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
    };

    window.addEventListener(`clipboard-update-${storageKey}`, handleExternalUpdate);
    return () => window.removeEventListener(`clipboard-update-${storageKey}`, handleExternalUpdate);
  }, [storageKey]);

  const handleAddItemClick = () => {
    setIsAdding(true);
    setNewItemText('');
  };

  const saveNewItem = () => {
    if (newItemText && newItemText.trim() !== '') {
      const newItems: ClipboardItem[] = [];
      
      const lines = newItemText.split(/\r?\n|\r/);
      lines.forEach(line => {
        const subItems = line.split(/(?<=:)/);
        subItems.forEach(subItem => {
          if (subItem.trim() !== '') {
            newItems.push({
              id: `item-${Date.now()}-${Math.random()}`,
              text: subItem
            });
          }
        });
      });

      setItems(prev => [...prev, ...newItems]);
    }
    setIsAdding(false);
    setNewItemText('');
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

  const startEditing = (item: ClipboardItem) => {
    setEditingId(item.id);
    setEditText(item.text);
  };

  const saveEdit = (id: string) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, text: editText } : item
    ));
    setEditingId(null);
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
        <button className="drag-handle" style={{ cursor: searchTerm ? 'default' : 'move', opacity: searchTerm ? 0.3 : 1 }}>
          <GripHorizontal size={14} />
        </button>
        
        {editingId === item.id ? (
          <textarea 
            value={editText} 
            onChange={(e) => setEditText(e.target.value)}
            onBlur={() => saveEdit(item.id)}
            autoFocus
            style={{ width: '100%', height: '50px' }}
          />
        ) : (
          <span 
            className="item-text"
            onClick={() => onPaste(item.text)} 
            onMouseDown={(e) => e.preventDefault()}
          >
            {item.text}
          </span>
        )}

        {editingId !== item.id && (
          <>
            <button className="edit" onClick={() => startEditing(item)}>
              <Edit size={14} />
            </button>
            <button className="delete" onClick={() => deleteItem(item.id)}>
              <Trash2 size={14} />
            </button>
          </>
        )}
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

      {isAdding && (
        <div style={{ padding: '10px', borderBottom: '1px solid #ccc' }}>
          <textarea
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            placeholder="ใส่ข้อความที่นี่..."
            style={{ width: '100%', height: '60px', marginBottom: '5px', borderRadius: '5px', border: '1px solid #ccc', padding: '5px' }}
            autoFocus
          />
          <div style={{ display: 'flex', gap: '5px' }}>
            <button className="action-btn" onClick={saveNewItem} style={{ fontSize: '12px', margin: 0 }}>บันทึก</button>
            <button className="action-btn" onClick={cancelAddItem} style={{ fontSize: '12px', backgroundColor: '#ccc', margin: 0, color: '#333' }}>ยกเลิก</button>
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
    </>
  );
};

