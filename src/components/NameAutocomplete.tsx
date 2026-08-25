import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';

interface NameAutocompleteProps {
  query: string;
  onSelect: (name: string) => void;
  onClose: () => void;
  position: { top: number; left: number };
  isFlipped?: boolean;
}

export const NameAutocomplete: React.FC<NameAutocompleteProps> = ({ query: initialQuery, onSelect, onClose, position, isFlipped }) => {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    // Load names from both clipboards
    const getNames = () => {
      const leftClip = localStorage.getItem('clipListLeft');
      const rightClip = localStorage.getItem('clipList');
      
      let allItems: any[] = [];
      
      const parseSafe = (data: string | null) => {
        if (!data) return [];
        try {
          const parsed = JSON.parse(data);
          return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
          return [];
        }
      };

      allItems = [...parseSafe(leftClip), ...parseSafe(rightClip)];

      // Extract unique names (before colon if exists)
      const names = allItems.map(item => {
        const text = (typeof item === 'string' ? item : item?.text) || '';
        return text.split(':')[0].trim();
      }).filter(Boolean);

      const uniqueNames = Array.from(new Set(names.filter(n => n !== '')));
      
      if (!query.trim()) {
        return uniqueNames.slice(0, 50); // Show first 50 if empty
      }

      return uniqueNames.filter(name => 
        name.toLowerCase().includes(query.toLowerCase())
      );
    };

    const filtered = getNames();
    setResults(filtered);
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      setSelectedIndex(prev => results.length > 0 ? (prev + 1) % results.length : 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      setSelectedIndex(prev => results.length > 0 ? (prev - 1 + results.length) % results.length : 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (results[selectedIndex]) {
        onSelect(results[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    } else if (e.key === 'Tab') {
        // If only one result, or if we have a selection
        if (results.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            onSelect(results[selectedIndex]);
        }
    }
  };

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  return (
    <div 
      ref={containerRef}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 2000,
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        width: '300px',
        maxHeight: '400px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transform: isFlipped ? 'translateY(-100%)' : 'none'
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '8px 12px',
        borderBottom: '1px solid #f3f4f6',
        backgroundColor: '#f9fafb'
      }}>
        <Search size={14} style={{ color: '#9ca3af', marginRight: '8px' }} />
        <input 
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="ค้นหาชื่อ..."
          style={{
            border: 'none',
            outline: 'none',
            backgroundColor: 'transparent',
            flex: 1,
            fontSize: '14px',
            fontFamily: 'Sarabun, sans-serif'
          }}
        />
      </div>
      
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {results.length === 0 ? (
          <div style={{ padding: '12px', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>
            ไม่พบรายชื่อที่ใกล้เคียง
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {results.map((name, index) => (
              <li 
                key={name}
                onClick={() => onSelect(name)}
                onMouseEnter={() => setSelectedIndex(index)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  backgroundColor: index === selectedIndex ? '#eff6ff' : 'transparent',
                  color: index === selectedIndex ? '#1d4ed8' : '#374151',
                  fontSize: '13px',
                  fontFamily: 'Sarabun, sans-serif',
                  borderLeft: index === selectedIndex ? '3px solid #3b82f6' : '3px solid transparent'
                }}
              >
                {name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
