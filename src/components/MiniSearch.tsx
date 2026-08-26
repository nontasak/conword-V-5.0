import React, { useState, useEffect } from 'react';
import { Search, X, ExternalLink } from 'lucide-react';

interface MiniSearchProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery: string;
  onInsert: (text: string) => void;
}

export const MiniSearch: React.FC<MiniSearchProps> = ({ isOpen, onClose, initialQuery, onInsert }) => {
  const [query, setQuery] = useState('');
  const [activeSearch, setActiveSearch] = useState('');

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
      if (isOpen) {
        setActiveSearch(initialQuery);
      }
    }
  }, [initialQuery, isOpen]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setActiveSearch(query);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', 
      bottom: '20px', 
      right: '20px', 
      width: '600px', 
      height: '600px',
      minWidth: '400px',
      minHeight: '400px',
      backgroundColor: 'white', 
      borderRadius: '8px', 
      boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
      display: 'flex', 
      flexDirection: 'column', 
      zIndex: 1000, 
      border: '1px solid #e5e7eb', 
      overflow: 'hidden',
      resize: 'both',
      fontFamily: '"Sarabun", "Tahoma", sans-serif'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 15px', backgroundColor: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}>
        <h3 style={{ margin: 0, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px', color: '#374151', fontWeight: 600 }}>
          <Search size={16} color="#2563eb" /> ค้นหาด้วย Google
        </h3>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button 
            onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(activeSearch || query)}`, '_blank')} 
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#6b7280', display: 'flex', alignItems: 'center' }} 
            title="เปิดในแท็บใหม่ (Google Search)"
          >
            <ExternalLink size={16} />
          </button>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#6b7280', display: 'flex', alignItems: 'center' }}>
            <X size={18} />
          </button>
        </div>
      </div>
      
      {/* Search Input */}
      <form onSubmit={handleSearch} style={{ padding: '10px', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: '8px', backgroundColor: '#fff' }}>
        <input 
          type="text" 
          value={query} 
          onChange={e => setQuery(e.target.value)}
          placeholder="ค้นหาใน Google..."
          style={{ flexGrow: 1, padding: '8px 12px', borderRadius: '4px', border: '1px solid #d1d5db', outline: 'none', fontSize: '13px', fontFamily: 'inherit' }}
        />
        <button 
          type="submit"
          style={{ padding: '8px 14px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', fontWeight: 500 }}
        >
          ค้นหา
        </button>
      </form>

      {/* Iframe */}
      <div style={{ flexGrow: 1, backgroundColor: '#fff', position: 'relative', overflow: 'hidden' }}>
        {activeSearch ? (
          <iframe 
            src={`https://www.google.com/search?igu=1&q=${encodeURIComponent(activeSearch)}`}
            style={{ 
              width: '100%', 
              height: '100%', 
              border: 'none'
            }}
            title="Google Search"
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6b7280', fontSize: '14px', backgroundColor: '#f9fafb', gap: '8px' }}>
            <Search size={32} color="#9ca3af" />
            <span>พิมพ์คำที่ต้องการค้นหาด้วย Google ด้านบน</span>
          </div>
        )}
      </div>
    </div>
  );
};
