import React, { useState, useEffect } from 'react';
import { Plus, Trash2, X, Save, RotateCcw, Keyboard, Pencil, Check } from 'lucide-react';

export interface ShortcutConfig {
  id: string;
  keyCode: string; // e.g., "KeyX"
  displayKey: string; // e.g., "X"
  action: 'insert_text' | 'insert_speaker' | 'switch_speaker' | 'toggle_speech' | 'insert_speech_transcript';
  text?: string; // Content to insert
  label: string; // Description
}

interface ShortcutManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (shortcuts: ShortcutConfig[]) => void;
  initialShortcuts: ShortcutConfig[];
  defaultShortcuts: ShortcutConfig[];
}

export const ShortcutManager: React.FC<ShortcutManagerProps> = ({ isOpen, onClose, onSave, initialShortcuts, defaultShortcuts }) => {
  const [shortcuts, setShortcuts] = useState<ShortcutConfig[]>(initialShortcuts);
  
  // Form state
  const [recording, setRecording] = useState(false);
  const [newKeyCode, setNewKeyCode] = useState('');
  const [newDisplayKey, setNewDisplayKey] = useState('');
  const [newAction, setNewAction] = useState<'insert_text' | 'insert_speaker' | 'switch_speaker' | 'toggle_speech' | 'insert_speech_transcript'>('insert_text');
  const [newText, setNewText] = useState('');
  const [newLabel, setNewLabel] = useState('');
  
  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);

  const [confirmDialog, setConfirmDialog] = useState<{ show: boolean, message: string, onConfirm: () => void }>({
    show: false,
    message: '',
    onConfirm: () => {}
  });

  useEffect(() => {
    if (isOpen) {
      // Migrate old 'insert' action to 'insert_speaker' if necessary when opening
      const migratedShortcuts = initialShortcuts.map(s => {
        if ((s.action as any) === 'insert') {
          return { ...s, action: 'insert_speaker' as const };
        }
        return s;
      });
      setShortcuts(migratedShortcuts);
      resetForm();
    }
  }, [isOpen, initialShortcuts]);

  const resetForm = () => {
    setRecording(false);
    setNewKeyCode('');
    setNewDisplayKey('');
    setNewAction('insert_text');
    setNewText('');
    setNewLabel('');
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (recording) {
      e.preventDefault();
      e.stopPropagation();
      
      // Ignore modifier keys alone
      if (['Alt', 'Control', 'Shift', 'Meta'].includes(e.key)) return;

      setNewKeyCode(e.code);
      setNewDisplayKey(e.key.toUpperCase());
      setRecording(false);
    }
  };

  const handleEdit = (shortcut: ShortcutConfig) => {
    setEditingId(shortcut.id);
    setNewKeyCode(shortcut.keyCode);
    setNewDisplayKey(shortcut.displayKey);
    setNewAction(shortcut.action);
    setNewText(shortcut.text || '');
    setNewLabel(shortcut.label);
    setRecording(false);
  };

  const handleSaveShortcut = () => {
    if (!newKeyCode) {
      alert('กรุณากดปุ่มเพื่อตั้งค่าคีย์ลัด');
      return;
    }
    if ((newAction === 'insert_text' || newAction === 'insert_speaker') && !newText) {
      alert('กรุณาระบุข้อความที่ต้องการแทรก');
      return;
    }

    // Check for duplicates (exclude current editing item)
    const isDuplicate = shortcuts.some(s => s.keyCode === newKeyCode && s.id !== editingId);
    if (isDuplicate) {
      alert('ปุ่มนี้ถูกใช้งานแล้ว กรุณาเลือกปุ่มอื่น');
      return;
    }

    const shortcutData: ShortcutConfig = {
      id: editingId || Date.now().toString(),
      keyCode: newKeyCode,
      displayKey: newDisplayKey,
      action: newAction,
      text: (newAction === 'insert_text' || newAction === 'insert_speaker') ? newText : undefined,
      label: newLabel || (
        newAction === 'switch_speaker' ? 'สลับผู้พูด' : 
        newAction === 'toggle_speech' ? 'เริ่ม/หยุดพิมพ์ด้วยเสียง' :
        newAction === 'insert_speech_transcript' ? 'แทรกลงท้ายเอกสาร' :
        `แทรก "${newText}"`
      )
    };

    if (editingId) {
      setShortcuts(shortcuts.map(s => s.id === editingId ? shortcutData : s));
    } else {
      setShortcuts([...shortcuts, shortcutData]);
    }
    
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (editingId === id) {
      resetForm();
    }
    setShortcuts(shortcuts.filter(s => s.id !== id));
  };

  const handleResetDefaults = () => {
    setConfirmDialog({
      show: true,
      message: 'คุณต้องการรีเซ็ตคีย์ลัดทั้งหมดกลับเป็นค่าเริ่มต้นหรือไม่?',
      onConfirm: () => {
        setShortcuts(defaultShortcuts);
        resetForm();
      }
    });
  };

  const handleSave = () => {
    onSave(shortcuts);
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
          <h2 style={{ margin: 0, fontSize: '18px', fontFamily: 'Sarabun, sans-serif' }}>ตั้งค่าคีย์ลัด (Keyboard Shortcuts)</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ 
          padding: '15px', 
          backgroundColor: editingId ? '#fff7ed' : '#f9fafb', 
          borderRadius: '6px', 
          marginBottom: '15px',
          border: editingId ? '1px solid #fdba74' : '1px solid #e5e7eb'
        }}>
          <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 'bold', fontSize: '14px', color: editingId ? '#ea580c' : '#374151' }}>
              {editingId ? 'แก้ไขคีย์ลัด' : 'เพิ่มคีย์ลัดใหม่'}
            </span>
            {editingId && (
              <button onClick={resetForm} style={{ fontSize: '12px', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                ยกเลิกการแก้ไข
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#6b7280' }}>ปุ่ม (กด Alt + ...)</label>
              <button 
                onClick={() => setRecording(true)}
                onKeyDown={handleKeyDown}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: recording ? '2px solid #2563eb' : '1px solid #ccc',
                  borderRadius: '4px',
                  backgroundColor: recording ? '#eff6ff' : 'white',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'monospace',
                  color: recording ? '#2563eb' : 'inherit'
                }}
              >
                {recording ? 'กดปุ่มที่ต้องการ...' : (newDisplayKey ? `Alt + ${newDisplayKey}` : 'คลิกเพื่อตั้งปุ่ม')}
              </button>
            </div>
            
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#6b7280' }}>การทำงาน</label>
              <select 
                value={newAction} 
                onChange={(e) => setNewAction(e.target.value as any)}
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
              >
                <option value="insert_text">2.1 แทรกข้อความ (Insert Text)</option>
                <option value="insert_speaker">2.2 แทรกชื่อคน (Insert Speaker)</option>
                <option value="switch_speaker">2.3 สลับผู้พูด (Switch Speaker)</option>
                <option value="toggle_speech">2.4 เริ่ม/หยุด พิมพ์ด้วยเสียง (Speech Toggle)</option>
                <option value="insert_speech_transcript">2.5 แทรกลงท้ายเอกสาร (Speech Insert)</option>
              </select>
            </div>
          </div>

          {(newAction === 'insert_text' || newAction === 'insert_speaker') && (
            <div style={{ marginBottom: '10px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#6b7280' }}>ข้อความที่ต้องการแทรก</label>
              <input
                type="text"
                placeholder={newAction === 'insert_speaker' ? "เช่น ประธาน   :   " : "ข้อความที่ต้องการแทรก"}
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
              />
              {newAction === 'insert_speaker' && (
                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
                  * ระบบจะจัดย่อหน้าและขึ้นบรรทัดใหม่ให้อัตโนมัติเหมือนการใส่ชื่อประธาน
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
             <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: '#6b7280' }}>คำอธิบาย (Optional)</label>
              <input
                type="text"
                placeholder="เช่น ใส่ชื่อประธาน"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}
              />
             </div>
             <button onClick={handleSaveShortcut} style={{
                backgroundColor: editingId ? '#f97316' : '#2298e2',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '8px 16px',
                cursor: 'pointer',
                height: '35px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                {editingId ? <Save size={16} /> : <Plus size={16} />}
                {editingId ? 'บันทึก' : 'เพิ่ม'}
              </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #eee', borderRadius: '4px', marginBottom: '15px', padding: '5px' }}>
          {shortcuts.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: '#888', fontFamily: 'Sarabun, sans-serif' }}>ยังไม่มีคีย์ลัดที่บันทึกไว้</div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {shortcuts.map((shortcut, index) => (
                <li key={shortcut.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px',
                  borderBottom: '1px solid #eee',
                  backgroundColor: editingId === shortcut.id ? '#fff7ed' : (index % 2 === 0 ? '#f9f9f9' : 'white'),
                  fontFamily: 'Sarabun, sans-serif'
                }}>
                  <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flex: 1 }}>
                    <span style={{ 
                      fontWeight: 'bold', 
                      color: '#2563eb', 
                      backgroundColor: '#eff6ff', 
                      padding: '2px 8px', 
                      borderRadius: '4px',
                      border: '1px solid #bfdbfe',
                      minWidth: '80px',
                      textAlign: 'center'
                    }}>
                      Alt + {shortcut.displayKey}
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: '500', color: '#374151' }}>{shortcut.label}</span>
                      {shortcut.action === 'insert_text' && (
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>แทรกข้อความ: "{shortcut.text}"</span>
                      )}
                      {shortcut.action === 'insert_speaker' && (
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>แทรกชื่อคน: "{shortcut.text}"</span>
                      )}
                      {shortcut.action === 'switch_speaker' && (
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>สลับผู้พูดล่าสุด</span>
                      )}
                      {shortcut.action === 'toggle_speech' && (
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>เริ่ม/หยุด การถอดข้อความเสียง</span>
                      )}
                      {shortcut.action === 'insert_speech_transcript' && (
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>แทรกข้อความที่ถอดเสียงลงท้ายหน้ากระดาษ</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={() => handleEdit(shortcut)} style={{
                      background: 'none',
                      border: 'none',
                      color: '#f59e0b',
                      cursor: 'pointer',
                      padding: '4px',
                    }} title="แก้ไข">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => handleDelete(shortcut.id)} style={{
                      background: 'none',
                      border: 'none',
                      color: '#ef4444',
                      cursor: 'pointer',
                      padding: '4px',
                    }} title="ลบ">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              ))}
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
