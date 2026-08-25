import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Mic, MicOff, X, Play, Square, ArrowDownToLine, RefreshCw, Sparkles, Eraser, Loader2 } from 'lucide-react';
import { motion, AnimatePresence, useDragControls } from 'motion/react';
import { ShortcutConfig } from './ShortcutManager';

interface SpeechTranscriberProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertText: (text: string, isInterim?: boolean) => void;
  onSpeechUpdate?: (text: string, isInterim: boolean, isGhost: boolean) => void;
  shortcuts?: ShortcutConfig[];
}

export interface SpeechTranscriberHandle {
  toggleListening: () => void;
  handleInsertText: () => void;
}

const speechFormatter = {
  thaiRegex: /([\u0E00-\u0E7F])\s+([\u0E00-\u0E7F])/g,
  thaiNumRegex: /([\u0E00-\u0E7F])([0-9a-zA-Z])/g,
  numThaiRegex: /([0-9a-zA-Z])([\u0E00-\u0E7F])/g,
  format: (rawText: string) => {
    let text = rawText.replace(speechFormatter.thaiRegex, '$1$2');
    text = text.replace(speechFormatter.thaiNumRegex, '$1 $2');
    text = text.replace(speechFormatter.numThaiRegex, '$1 $2');
    return text;
  }
};

const combineTexts = (...parts: string[]): string => {
  return parts
    .map(p => (p || '').trim())
    .filter(Boolean)
    .join(' ');
};

export const SpeechTranscriber = forwardRef<SpeechTranscriberHandle, SpeechTranscriberProps>(({ isOpen, onClose, onInsertText, onSpeechUpdate, shortcuts = [] }, ref) => {
  const [isListening, setIsListening] = useState(false);
  const isListeningRef = useRef(isListening);
  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');

  // Store base transcript (from previous sessions / manual edits) and active session chunks
  const baseTranscriptRef = useRef('');
  const sessionFinalRef = useRef('');
  const sessionInterimRef = useRef('');

  // Find current shortcuts for display
  const toggleShortcut = shortcuts.find(s => s.action === 'toggle_speech');
  const insertShortcut = shortcuts.find(s => s.action === 'insert_speech_transcript');

  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isStoppingRef = useRef(false);
  
  const [status, setStatus] = useState<'idle' | 'starting' | 'listening' | 'error'>('idle');
  
  const onSpeechUpdateRef = useRef(onSpeechUpdate);
  useEffect(() => {
    onSpeechUpdateRef.current = onSpeechUpdate;
  }, [onSpeechUpdate]);
  const [size, setSize] = useState({ width: 500, height: 350 });
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const dragControls = useDragControls();

  // Resize and Position State
  // We'll use a ref to the prop function to avoid closure issues in the event listener
  const onInsertTextRef = useRef(onInsertText);
  useEffect(() => {
    onInsertTextRef.current = onInsertText;
  }, [onInsertText]);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript, interimTranscript]);

  // Center initially and handle window resize
  useEffect(() => {
    const clampPos = (x: number, y: number, w: number, h: number) => {
      const maxX = Math.max(0, window.innerWidth - w);
      const maxY = Math.max(0, window.innerHeight - h);
      return {
        x: Math.min(Math.max(0, x), maxX),
        y: Math.min(Math.max(0, y), maxY)
      };
    };

    if (isOpen) {
      const currentPos = position.x === 0 && position.y === 0 ? { 
        x: window.innerWidth / 2 - size.width / 2, 
        y: (window.innerHeight / 2 - size.height / 2) - 50
      } : position;
      
      setPosition(clampPos(currentPos.x, currentPos.y, size.width, size.height));
    }

    const handleWindowResize = () => {
      setPosition(prev => clampPos(prev.x, prev.y, size.width, size.height));
    };

    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [isOpen, size.width, size.height]);

  const handleResize = (direction: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent focus loss and other issues
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = size.width;
    const startHeight = size.height;
    const startPosX = position.x;
    const startPosY = position.y;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      let newWidth = startWidth;
      let newHeight = startHeight;
      let newPosX = startPosX;
      let newPosY = startPosY;

      if (direction.includes('e')) newWidth = Math.max(300, startWidth + deltaX);
      if (direction.includes('w')) {
        const potentialWidth = startWidth - deltaX;
        if (potentialWidth > 300) {
          newWidth = potentialWidth;
          newPosX = startPosX + deltaX;
        }
      }
      if (direction.includes('s')) newHeight = Math.max(200, startHeight + deltaY);
      if (direction.includes('n')) {
        const potentialHeight = startHeight - deltaY;
        if (potentialHeight > 200) {
          newHeight = potentialHeight;
          newPosY = startPosY + deltaY;
        }
      }

      setSize({ width: newWidth, height: newHeight });
      
      const maxX = Math.max(0, window.innerWidth - newWidth);
      const maxY = Math.max(0, window.innerHeight - newHeight);
      setPosition({ 
        x: Math.min(Math.max(0, newPosX), maxX), 
        y: Math.min(Math.max(0, newPosY), maxY) 
      });
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  useEffect(() => {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1; // Faster response by not looking for alternatives
    recognition.lang = 'th-TH';

    const speechFormatter = {
      thaiRegex: /([\u0E00-\u0E7F])\s+([\u0E00-\u0E7F])/g,
      thaiNumRegex: /([\u0E00-\u0E7F])([0-9a-zA-Z])/g,
      numThaiRegex: /([0-9a-zA-Z])([\u0E00-\u0E7F])/g,
      format: (rawText: string) => {
        let text = rawText.replace(speechFormatter.thaiRegex, '$1$2');
        text = text.replace(speechFormatter.thaiNumRegex, '$1 $2');
        text = text.replace(speechFormatter.numThaiRegex, '$1 $2');
        return text;
      }
    };

    recognition.onstart = () => {
      setStatus('listening');
      console.log('Speech recognition started');
    };

    recognition.onaudiostart = () => {
      console.log('Audio capture started');
    };

    recognition.onspeechstart = () => {
      console.log('Speech detected');
    };

    recognition.onresult = (event: any) => {
      if (isStoppingRef.current) return;
      
      let rawFinal = '';
      let rawInterim = '';
      
      const results = event.results;
      for (let i = 0; i < results.length; ++i) {
        const result = results[i];
        const transcriptText = result[0].transcript;
        if (result.isFinal) {
          rawFinal += transcriptText;
        } else {
          rawInterim += transcriptText;
        }
      }
      
      const formattedFinal = speechFormatter.format(rawFinal);
      const formattedInterim = speechFormatter.format(rawInterim);

      sessionFinalRef.current = formattedFinal;
      sessionInterimRef.current = formattedInterim;

      const currentFinal = combineTexts(baseTranscriptRef.current, formattedFinal);
      setTranscript(currentFinal);
      setInterimTranscript(formattedInterim);
    };

    recognition.onerror = (event: any) => {
      console.warn('Speech recognition error:', event.error);
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      if (event.error === 'not-allowed') {
        alert('กรุณาอนุญาตการเข้าถึงไมโครโฟน เพื่อใช้งานระบบถอดเสียง');
        setStatus('error');
      }
      setIsListening(false);
      isStoppingRef.current = true;
    };

    recognition.onend = () => {
      // Commit active session into baseTranscript
      let committed = baseTranscriptRef.current;
      if (sessionFinalRef.current) {
        committed = combineTexts(committed, sessionFinalRef.current);
        sessionFinalRef.current = '';
      }
      if (sessionInterimRef.current) {
        committed = combineTexts(committed, sessionInterimRef.current);
        sessionInterimRef.current = '';
      }
      baseTranscriptRef.current = committed;

      setTranscript(committed);
      setInterimTranscript('');

      // Auto restart if still supposed to be listening
      if (!isStoppingRef.current && isListeningRef.current) {
        try {
          recognition.start();
        } catch (e) {
          // Ignore start errors on auto-restart
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      isStoppingRef.current = true;
      recognition.stop();
    };
  }, []);

  // Separate effect to handle starting/stopping based on isListening
  useEffect(() => {
    if (!recognitionRef.current) return;
    
    if (isListening) {
      isStoppingRef.current = false;
      setStatus('starting');
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error('Recognition start failed:', e);
        setStatus('error');
      }
    } else {
      isStoppingRef.current = true;
      recognitionRef.current.stop();
      setStatus('idle');
    }
  }, [isListening]);

  const toggleListening = () => {
    if (isListening) {
      let committed = baseTranscriptRef.current;
      if (sessionFinalRef.current) {
        committed = combineTexts(committed, sessionFinalRef.current);
        sessionFinalRef.current = '';
      }
      if (sessionInterimRef.current) {
        committed = combineTexts(committed, sessionInterimRef.current);
        sessionInterimRef.current = '';
      }
      baseTranscriptRef.current = committed;

      setTranscript(committed);
      setInterimTranscript('');
    }
    setIsListening(prev => !prev);
  };

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    toggleListening,
    handleInsertText
  }));

  const clearTranscript = () => {
    baseTranscriptRef.current = '';
    sessionFinalRef.current = '';
    sessionInterimRef.current = '';
    setTranscript('');
    setInterimTranscript('');
  };

  const handleInsertText = () => {
    let fullText = baseTranscriptRef.current;
    if (sessionFinalRef.current) {
      fullText = combineTexts(fullText, sessionFinalRef.current);
    }
    if (sessionInterimRef.current) {
      fullText = combineTexts(fullText, sessionInterimRef.current);
    }

    if (!fullText) return;

    onInsertTextRef.current(fullText);

    baseTranscriptRef.current = '';
    sessionFinalRef.current = '';
    sessionInterimRef.current = '';
    setTranscript('');
    setInterimTranscript('');

    // Flush recognition buffer by restarting if active
    if (isListeningRef.current && recognitionRef.current) {
      isStoppingRef.current = true;
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      setTimeout(() => {
        if (isListeningRef.current) {
          isStoppingRef.current = false;
          try {
            recognitionRef.current.start();
          } catch (e) {
            console.error('Restart failed:', e);
          }
        }
      }, 200);
    }
  };

  const dragInfoRef = useRef({ isDragging: false, threshold: 5 });
  const handleDrag = (e: React.MouseEvent) => {
    // Only handle left click for dragging
    if (e.button !== 0) return;
    
    e.preventDefault();
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startPosX = position.x;
    const startPosY = position.y;
    
    dragInfoRef.current.isDragging = false;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startMouseX;
      const deltaY = moveEvent.clientY - startMouseY;
      
      if (!dragInfoRef.current.isDragging) {
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        if (distance > dragInfoRef.current.threshold) {
          dragInfoRef.current.isDragging = true;
        }
      }

      const newX = Math.min(Math.max(0, startPosX + deltaX), window.innerWidth - size.width);
      const newY = Math.min(Math.max(0, startPosY + deltaY), window.innerHeight - size.height);
      
      setPosition({ x: newX, y: newY });
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div 
        key="speech-transcriber-panel"
        tabIndex={-1}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1, left: position.x, top: position.y }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{
          left: { duration: 0 },
          top: { duration: 0 },
          scale: { type: 'spring', damping: 20, stiffness: 300 },
          opacity: { duration: 0.2 }
        }}
        style={{
          position: 'fixed',
          width: size.width,
          height: size.height,
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          border: '1px solid #e5e7eb',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          userSelect: 'none',
          overflow: 'visible'
        }}
      >
        {/* Resize Handles */}
        <div onMouseDown={(e) => handleResize('n', e)} style={{ position: 'absolute', top: -4, left: 0, right: 0, height: 8, cursor: 'ns-resize', zIndex: 10 }} />
        <div onMouseDown={(e) => handleResize('s', e)} style={{ position: 'absolute', bottom: -4, left: 0, right: 0, height: 8, cursor: 'ns-resize', zIndex: 10 }} />
        <div onMouseDown={(e) => handleResize('e', e)} style={{ position: 'absolute', right: -4, top: 0, bottom: 0, width: 8, cursor: 'ew-resize', zIndex: 10 }} />
        <div onMouseDown={(e) => handleResize('w', e)} style={{ position: 'absolute', left: -4, top: 0, bottom: 0, width: 8, cursor: 'ew-resize', zIndex: 10 }} />
        <div onMouseDown={(e) => handleResize('nw', e)} style={{ position: 'absolute', top: -4, left: -4, width: 12, height: 12, cursor: 'nwse-resize', zIndex: 11 }} />
        <div onMouseDown={(e) => handleResize('ne', e)} style={{ position: 'absolute', top: -4, right: -4, width: 12, height: 12, cursor: 'nesw-resize', zIndex: 11 }} />
        <div onMouseDown={(e) => handleResize('sw', e)} style={{ position: 'absolute', bottom: -4, left: -4, width: 12, height: 12, cursor: 'nesw-resize', zIndex: 11 }} />
        <div onMouseDown={(e) => handleResize('se', e)} style={{ position: 'absolute', bottom: -4, right: -4, width: 12, height: 12, cursor: 'nwse-resize', zIndex: 11 }} />

        {/* Header - Drag Handle */}
        <div 
          onMouseDown={handleDrag}
          style={{ 
            backgroundColor: '#0b3955', 
            padding: '10px 16px', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            color: 'white', 
            cursor: 'grab',
            borderTopLeftRadius: '11px',
            borderTopRightRadius: '11px',
            flexShrink: 0
          }} 
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ 
                width: '32px', 
                height: '32px', 
                borderRadius: '50%', 
                backgroundColor: isListening ? '#ef4444' : '#6b7280',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                zIndex: 2,
                transition: 'all 0.2s',
                boxShadow: isListening ? '0 0 12px #ef4444' : 'none'
              }}>
                <Mic size={18} className={isListening ? 'animate-pulse' : ''} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '15px', fontWeight: 'bold', lineHeight: 1 }}>ถอดเสียงการประชุม</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ 
                  width: '8px', 
                  height: '8px', 
                  borderRadius: '50%', 
                  backgroundColor: isListening ? '#22c55e' : '#9ca3af',
                  boxShadow: isListening ? '0 0 8px #22c55e' : 'none',
                  transition: 'background-color 0.3s'
                }} />
                <span style={{ fontSize: '11px', opacity: 0.9 }}>
                  {status === 'listening' ? 'กำลังทำงาน: รับเสียงอยู่...' : 
                   status === 'starting' ? 'กำลังเชื่อมต่อไมโครโฟน...' :
                   status === 'error' ? 'เกิดข้อผิดพลาด: ตรวจสอบไมค์' :
                   'พร้อมใช้งาน: กด "เริ่มฟัง"'}
                </span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button 
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={onClose} 
              style={{ padding: '4px', borderRadius: '50%', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: 'white', opacity: 0.8 }} 
              className="hover:opacity-100 transition-opacity"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, padding: '12px', backgroundColor: '#f9fafb', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div 
            ref={scrollRef}
            onMouseDown={(e) => e.preventDefault()}
            style={{ 
              padding: '12px', 
              backgroundColor: 'white', 
              borderRadius: '8px',
              border: '1px solid #e5e7eb',
              flex: 1,
              overflowY: 'auto',
              fontSize: '15px',
              lineHeight: '1.6',
              color: '#1f2937'
            }}
          >
            {transcript || interimTranscript ? (
              <div style={{ position: 'relative' }}>
                <p style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#000000' }}>
                  {transcript}
                  {transcript && interimTranscript ? ' ' : ''}
                  <span style={{ color: '#4b5563', fontStyle: 'italic' }}>{interimTranscript}</span>
                </p>
              </div>
            ) : (
              <div style={{ height: '70px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', gap: '4px' }}>
                <Mic size={24} strokeWidth={1} />
                <div style={{ fontSize: '12px' }}>กดปุ่มเริ่ม เพื่อถอดเสียงแบบเรียลไทม์</div>
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '10px 12px', borderTop: '1px solid #f3f4f6', display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: 'white' }}>
          {/* Top row: Start listening and Insert to document side-by-side */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button 
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={toggleListening}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '13px',
                transition: 'all 0.2s',
                backgroundColor: isListening ? '#ef4444' : '#2563eb',
                color: 'white'
              }}
              className="hover:opacity-90"
              title={toggleShortcut ? `Alt + ${toggleShortcut.displayKey}` : undefined}
            >
              {isListening ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
              {isListening 
                ? `หยุดฟัง ${toggleShortcut ? `(Alt+${toggleShortcut.displayKey})` : ''}` 
                : `เริ่มฟัง ${toggleShortcut ? `(Alt+${toggleShortcut.displayKey})` : ''}`
              }
            </button>

            <button 
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleInsertText}
              disabled={!transcript && !interimTranscript}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '13px',
                backgroundColor: '#059669',
                color: 'white',
                transition: 'all 0.2s'
              }}
              className="hover:bg-emerald-700 disabled:opacity-50"
              title={insertShortcut ? `Alt + ${insertShortcut.displayKey}` : undefined}
            >
              <ArrowDownToLine size={16} />
              แทรกลงท้ายเอกสาร {insertShortcut ? `(Alt+${insertShortcut.displayKey})` : ''}
            </button>
          </div>

          {/* Bottom row: Clear button placed below */}
          <div>
            <button 
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onClick={clearTranscript}
              disabled={!transcript && !interimTranscript}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                padding: '5px 12px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: '#f3f4f6',
                color: '#6b7280',
                transition: 'all 0.2s'
              }}
              className="hover:bg-gray-200 disabled:opacity-30"
              title="ล้างข้อความ"
            >
              <Eraser size={14} />
              <span style={{ fontSize: '12px' }}>ล้าง</span>
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
});
