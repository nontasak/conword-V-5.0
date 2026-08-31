import React, { useState, useEffect } from 'react';
import { Plus, Trash2, X, Save, RotateCcw, Pencil, Check } from 'lucide-react';

export interface Snippet {
  id: string;
  abbr: string;
  fullText: string;
}

interface SnippetManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (snippets: Snippet[]) => void;
  initialSnippets: Snippet[];
  defaultSnippets: Snippet[];
}

export const SnippetManager: React.FC<SnippetManagerProps> = ({ isOpen, onClose, onSave, initialSnippets, defaultSnippets }) => {
  const [snippets, setSnippets] = useState<Snippet[]>(initialSnippets);
  const [newAbbr, setNewAbbr] = useState('');
  const [newFullText, setNewFullText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAbbr, setEditAbbr] = useState('');
  const [editFullText, setEditFullText] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{ show: boolean, message: string, onConfirm: () => void }>({
    show: false,
    message: '',
    onConfirm: () => {}
  });

  useEffect(() => {
    if (isOpen) {
        setSnippets(initialSnippets);
        setEditingId(null);
        setEditAbbr('');
        setEditFullText('');
    }
  }, [isOpen, initialSnippets]);

  const handleAdd = () => {
    if (newAbbr && newFullText) {
      const newSnippet: Snippet = {
        id: Date.now().toString(),
        abbr: newAbbr.trim(),
        fullText: newFullText
      };
      setSnippets([...snippets, newSnippet]);
      setNewAbbr('');
      setNewFullText('');
    }
  };

  const startEditing = (snippet: Snippet) => {
    setEditingId(snippet.id);
    setEditAbbr(snippet.abbr);
    setEditFullText(snippet.fullText);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditAbbr('');
    setEditFullText('');
  };

  const handleSaveEdit = (id: string) => {
    if (editAbbr.trim() && editFullText.trim()) {
      setSnippets(snippets.map(s => s.id === id ? { ...s, abbr: editAbbr.trim(), fullText: editFullText } : s));
      cancelEditing();
    }
  };

  const handleDelete = (id: string) => {
    if (editingId === id) {
      cancelEditing();
    }
    setSnippets(snippets.filter(s => s.id !== id));
  };

  const handleResetDefaults = () => {
    setConfirmDialog({
      show: true,
      message: 'คุณต้องการรีเซ็ตคำย่อทั้งหมดกลับเป็นค่าเริ่มต้นหรือไม่?',
      onConfirm: () => {
        setSnippets(defaultSnippets);
        cancelEditing();
      }
    });
  };

  const handleSave = () => {
    onSave(snippets);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        width: '600px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontFamily: 'Sarabun, sans-serif' }}>จัดการคำย่อ (Custom Snippets)</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
          <input
            type="text"
            placeholder="คำย่อ (เช่น ว1..)"
            value={newAbbr}
            onChange={(e) => setNewAbbr(e.target.value)}
            style={{ flex: 1, padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontFamily: 'Sarabun, sans-serif' }}
          />
          <input
            type="text"
            placeholder="ข้อความเต็มที่ต้องการแทนที่"
            value={newFullText}
            onChange={(e) => setNewFullText(e.target.value)}
            style={{ flex: 2, padding: '8px', border: '1px solid #ccc', borderRadius: '4px', fontFamily: 'Sarabun, sans-serif' }}
          />
          <button onClick={handleAdd} style={{
            backgroundColor: '#2298e2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '8px 12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center'
          }} title="เพิ่มคำย่อ">
            <Plus size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #eee', borderRadius: '4px', marginBottom: '15px', padding: '5px' }}>
          {snippets.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#888', fontFamily: 'Sarabun, sans-serif' }}>ยังไม่มีคำย่อที่บันทึกไว้</div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {snippets.map((snippet, index) => {
                const isEditing = editingId === snippet.id;
                return (
                  <li key={snippet.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 10px',
                    borderBottom: '1px solid #eee',
                    backgroundColor: isEditing ? '#eff6ff' : (index % 2 === 0 ? '#f9f9f9' : 'white'),
                    fontFamily: 'Sarabun, sans-serif'
                  }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: 1 }}>
                        <input
                          type="text"
                          value={editAbbr}
                          onChange={(e) => setEditAbbr(e.target.value)}
                          placeholder="คำย่อ"
                          style={{
                            width: '90px',
                            padding: '6px 8px',
                            border: '1px solid #3b82f6',
                            borderRadius: '4px',
                            fontSize: '14px',
                            fontWeight: 'bold',
                            color: '#1e40af',
                            backgroundColor: '#fff',
                            fontFamily: 'Sarabun, sans-serif'
                          }}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(snippet.id);
                            if (e.key === 'Escape') cancelEditing();
                          }}
                        />
                        <span style={{ color: '#9ca3af' }}>→</span>
                        <input
                          type="text"
                          value={editFullText}
                          onChange={(e) => setEditFullText(e.target.value)}
                          placeholder="ข้อความเต็ม"
                          style={{
                            flex: 1,
                            padding: '6px 8px',
                            border: '1px solid #3b82f6',
                            borderRadius: '4px',
                            fontSize: '14px',
                            color: '#1f2937',
                            backgroundColor: '#fff',
                            fontFamily: 'Sarabun, sans-serif'
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(snippet.id);
                            if (e.key === 'Escape') cancelEditing();
                          }}
                        />
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flex: 1, overflow: 'hidden' }}>
                        <span style={{ fontWeight: 'bold', minWidth: '60px', color: '#2563eb' }}>{snippet.abbr}</span>
                        <span style={{ color: '#9ca3af' }}>→</span>
                        <span style={{ color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={snippet.fullText}>{snippet.fullText}</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '4px', marginLeft: '8px', alignItems: 'center' }}>
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(snippet.id)}
                            disabled={!editAbbr.trim() || !editFullText.trim()}
                            style={{
                              backgroundColor: '#2563eb',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              padding: '5px 8px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '12px',
                              opacity: (!editAbbr.trim() || !editFullText.trim()) ? 0.5 : 1
                            }}
                            title="บันทึกการแก้ไข"
                          >
                            <Check size={14} /> บันทึก
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditing}
                            style={{
                              backgroundColor: '#e5e7eb',
                              color: '#374151',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              padding: '5px 8px',
                              display: 'flex',
                              alignItems: 'center',
                              fontSize: '12px'
                            }}
                            title="ยกเลิก"
                          >
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startEditing(snippet)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#2563eb',
                              cursor: 'pointer',
                              padding: '4px 6px',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '2px',
                              fontSize: '12px'
                            }}
                            title="แก้ไขคำย่อนี้"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(snippet.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              padding: '4px 6px',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                            title="ลบคำย่อนี้"
                          >
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={handleResetDefaults} style={{
            padding: '8px 12px',
            border: '1px solid #e5e7eb',
            borderRadius: '4px',
            backgroundColor: 'white',
            color: '#6b7280',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            fontFamily: 'Sarabun, sans-serif'
          }}>
            <RotateCcw size={14} /> รีเซ็ตค่าเริ่มต้น
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={onClose} style={{
              padding: '8px 16px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              backgroundColor: 'white',
              cursor: 'pointer',
              fontFamily: 'Sarabun, sans-serif'
            }}>ยกเลิก</button>
            <button onClick={handleSave} style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: '#2298e2',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontFamily: 'Sarabun, sans-serif'
            }}>
              <Save size={16} /> บันทึก
            </button>
          </div>
        </div>
      </div>

      {/* Confirm Dialog Modal */}
      {confirmDialog.show && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.5)'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            padding: '24px',
            maxWidth: '384px',
            width: '100%',
            margin: '0 16px'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#111827', marginBottom: '8px', fontFamily: 'Sarabun, sans-serif' }}>ยืนยันการดำเนินการ</h3>
            <p style={{ fontSize: '14px', color: '#4b5563', marginBottom: '24px', fontFamily: 'Sarabun, sans-serif' }}>{confirmDialog.message}</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setConfirmDialog({ show: false, message: '', onConfirm: () => {} })}
                style={{ padding: '8px 16px', fontSize: '14px', fontWeight: '500', color: '#374151', backgroundColor: '#f3f4f6', border: 'none', borderRadius: '6px', cursor: 'pointer', fontFamily: 'Sarabun, sans-serif' }}
              >
                ยกเลิก
              </button>
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog({ show: false, message: '', onConfirm: () => {} });
                }}
                style={{ padding: '8px 16px', fontSize: '14px', fontWeight: '500', color: 'white', backgroundColor: '#dc2626', border: 'none', borderRadius: '6px', cursor: 'pointer', fontFamily: 'Sarabun, sans-serif' }}
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
