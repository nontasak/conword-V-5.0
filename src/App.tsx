/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { useClock } from './hooks/useClock';
import { 
  arabicNumberToThaiNumberAndReplace, 
  processPlusSigns, 
  findAndAlertErrors 
} from './utils/textProcessing';
import { Clipboard } from './components/Clipboard';
import { SnippetManager, Snippet } from './components/SnippetManager';
import { ShortcutManager, ShortcutConfig } from './components/ShortcutManager';
import { MiniSearch } from './components/MiniSearch';
import { AutoSpeaker } from './components/AutoSpeaker';
import { CommitteeSpeaker } from './components/CommitteeSpeaker';
import { SENATORS_200 } from './constants/senators';
import { CommitteeIdentifier } from './components/CommitteeIdentifier';
import { PdfConverterModal } from './components/PdfConverter/PdfConverterModal';
import { CommitteeReportGeneratorModal } from './components/CommitteeReportGenerator/CommitteeReportGeneratorModal';
import { MeetingHeaderModal } from './components/MeetingHeaderModal';
import { HistoryModal } from './components/HistoryModal';
import { EmergencyRecoveryModal, EmergencyBackupData } from './components/EmergencyRecoveryModal';
import { ClipboardSettingsModal } from './components/ClipboardSettingsModal';
import { 
  requestPersistentStorage, 
  getItem, 
  setItem, 
  saveTextSnapshot, 
  clearActiveText,
  saveEmergencyBackup,
  checkPostEvictionDataLoss,
  markDataLossResolved,
  setUserClearedState
} from './utils/persistentStorage';
import { initAuth } from './lib/firebase';
import { ChevronUp, ChevronDown, Save, FileText, Check, AlertCircle, Copy, Eraser, Minus, Plus, Type, Settings, Keyboard, PanelLeft, PanelRight, Scissors, ClipboardPaste, Search, ArrowDownToLine, Crosshair, Users, Image as ImageIcon, Wand2, ChevronRight, BrainCircuit, Undo2, Redo2, Layout, History, SlidersHorizontal } from 'lucide-react';

// Clock Component
const Clock = () => {
  const time = useClock();
  return <div id="clock">{time}</div>;
};

const defaultSnippets: Snippet[] = [
  { id: '1', abbr: "ป..", fullText: "ประธาน   :   " },
  { id: '2', abbr: "เล..", fullText: "เลขานุการ   :   " },
  { id: '3', abbr: "จท..", fullText: "เจ้าหน้าที่คณะกรรมาธิการ   :   " },
  { id: '4', abbr: "จนท..", fullText: "เจ้าหน้าที่คณะกรรมาธิการ   :   " },
  { id: '5', abbr: "จอ..", fullText: "เจ้าหน้าที่คณะอนุกรรมาธิการ   :   " },
  { id: '6', abbr: "จนอ..", fullText: "เจ้าหน้าที่คณะอนุกรรมาธิการ   :   " },
  { id: '7', abbr: "ผขร..", fullText: "ผู้เข้าร่วมประชุม   :   " },
  { id: '8', abbr: "เลิก..", fullText: "เลิกประชุมเวลา    นาฬิกา" },
  { id: '9', abbr: "สน..", fullText: "สำนักรายงานการประชุมและชวเลข" },
];

const defaultShortcuts: ShortcutConfig[] = [
  { id: '1', keyCode: 'KeyX', displayKey: 'X', action: 'insert_speaker', text: 'ประธาน   :   ', label: 'ใส่ชื่อประธาน' },
  { id: '2', keyCode: 'KeyS', displayKey: 'S', action: 'switch_speaker', label: 'สลับผู้พูด' },
  { id: '3', keyCode: 'KeyQ', displayKey: 'Q', action: 'toggle_speech', label: 'เริ่ม/หยุดพิมพ์ด้วยเสียง' },
  { id: '4', keyCode: 'KeyW', displayKey: 'W', action: 'insert_speech_transcript', label: 'แทรกลงท้ายเอกสาร' },
];

import { AITrainingModal } from './components/AITrainingModal';
import { ThaiProofAIModal } from './components/ThaiProofAI/ThaiProofAIModal';
import { SpeechTranscriber, SpeechTranscriberHandle } from './components/SpeechTranscriber';
import { VoiceSpeakerManager } from './components/VoiceSpeakerManager';
import { SeatingPlannerModal } from './components/SeatingPlanner/SeatingPlannerModal';
import { NameAutocomplete } from './components/NameAutocomplete';
import { SelectionToolbar } from './components/SelectionToolbar';
import { SpellCheck, Mic, MessageSquare } from 'lucide-react';

function App() {
  const [text, setText] = useState('');
  // Responsive initialization for desktop vs tablet/mobile
  const [isClipboardOpen, setIsClipboardOpen] = useState(() => window.innerWidth > 500);
  const [isLeftClipboardOpen, setIsLeftClipboardOpen] = useState(() => window.innerWidth >= 1024);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [clipboardHeight, setClipboardHeight] = useState(0);

  // Clipboard Customization States (Width & Item Font Size)
  const [clipboardWidth, setClipboardWidth] = useState<number>(() => {
    const saved = localStorage.getItem('conword_clipboard_width');
    return saved ? Number(saved) : 260;
  });
  const [clipboardFontSize, setClipboardFontSize] = useState<number>(() => {
    const saved = localStorage.getItem('conword_clipboard_font_size');
    return saved ? Number(saved) : 14;
  });
  const [isClipboardSettingsOpen, setIsClipboardSettingsOpen] = useState(false);

  const handleClipboardWidthChange = (newWidth: number) => {
    setClipboardWidth(newWidth);
    localStorage.setItem('conword_clipboard_width', String(newWidth));
  };

  const handleClipboardFontSizeChange = (newSize: number) => {
    setClipboardFontSize(newSize);
    localStorage.setItem('conword_clipboard_font_size', String(newSize));
  };

  const handleResetClipboardSettings = () => {
    handleClipboardWidthChange(260);
    handleClipboardFontSizeChange(14);
  };

  // Cursor preservation logic
  const pendingCursorRestore = useRef<{ start: number, end: number, scroll: number } | null>(null);

  useLayoutEffect(() => {
    if (pendingCursorRestore.current && textareaRef.current) {
      const { start, end, scroll } = pendingCursorRestore.current;
      textareaRef.current.setSelectionRange(start, end);
      textareaRef.current.scrollTop = scroll;
      pendingCursorRestore.current = null;
    }
  }, [text]);

  // Scroll maintenance
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (selectionToolbar.show) {
      setSelectionToolbar(prev => ({ ...prev, show: false }));
    }
  };

  // Sync scroll is no longer needed for mirror, but we keep it for general maintenance if needed
  useEffect(() => {
    // Scroll maintenance if any
  }, [text]);

  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Font size state
  const [fontSize, setFontSize] = useState(16);

  // Snippet Manager State
  const [isSnippetManagerOpen, setIsSnippetManagerOpen] = useState(false);
  const [customSnippets, setCustomSnippets] = useState<Snippet[]>(defaultSnippets);

  // Shortcut Manager State
  const [isShortcutManagerOpen, setIsShortcutManagerOpen] = useState(false);
  const [shortcuts, setShortcuts] = useState<ShortcutConfig[]>(defaultShortcuts);

  // State for tracking recent speakers for rapid switching
  const [recentSpeakers, setRecentSpeakers] = useState<string[]>([]);
  const [lastActiveSpeaker, setLastActiveSpeaker] = useState<string | null>(null);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState({
    show: false, x: 0, y: 0, selectedText: '', selectionStart: 0, selectionEnd: 0
  });

  // Mini Search State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Committee Identifier State
  const [isCommitteeIdentifierOpen, setIsCommitteeIdentifierOpen] = useState(false);

  // Auto Speaker State
  const [isAutoSpeakerOpen, setIsAutoSpeakerOpen] = useState(false);
  const [isCommitteeSpeakerOpen, setIsCommitteeSpeakerOpen] = useState(false);
  const [isSpeakerMenuOpen, setIsSpeakerMenuOpen] = useState(false);
  const speakerMenuRef = useRef<HTMLDivElement>(null);

  // PDF Converter State
  const [isPdfConverterOpen, setIsPdfConverterOpen] = useState(false);

  // Committee Report Generator State
  const [isCommitteeReportGeneratorOpen, setIsCommitteeReportGeneratorOpen] = useState(false);

  // AI Training State
  const [isAITrainingOpen, setIsAITrainingOpen] = useState(false);

  // ThaiProof-AI State
  const [isThaiProofAIOpen, setIsThaiProofAIOpen] = useState(false);

  // Speech Transcriber State
  const [isSpeechTranscriberOpen, setIsSpeechTranscriberOpen] = useState(false);
  const speechTranscriberRef = useRef<SpeechTranscriberHandle>(null);

  // Voice Speaker Manager State
  const [isVoiceSpeakerManagerOpen, setIsVoiceSpeakerManagerOpen] = useState(false);

  // Undo/Redo states
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  
  // Meeting Header Modal state
  const [isHeaderModalOpen, setIsHeaderModalOpen] = useState(false);

  // History Modal State (IndexedDB Local Snapshots)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Emergency Data Loss Recovery State (Post-Eviction Detection)
  const [isEmergencyRecoveryOpen, setIsEmergencyRecoveryOpen] = useState(false);
  const [emergencyBackupData, setEmergencyBackupData] = useState<EmergencyBackupData | null>(null);

  const isLoadedFromStorageRef = useRef(false);
  const lastSnapshotTextRef = useRef('');
  const lastSnapshotTimeRef = useRef(0);

  const checkUndoRedoStatus = useCallback(() => {
    if (textareaRef.current) {
        // Focus is often required for these to be accurate
        const hasUndo = document.queryCommandEnabled('undo');
        const hasRedo = document.queryCommandEnabled('redo');
        setCanUndo(hasUndo);
        setCanRedo(hasRedo);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(checkUndoRedoStatus, 100);
    return () => clearTimeout(timer);
  }, [text, checkUndoRedoStatus]);

  useEffect(() => {
    // Initialize Auth
    const unsubscribe = initAuth();
    return () => unsubscribe();
  }, []);

  // Seating Planner State
  const [isSeatingPlannerOpen, setIsSeatingPlannerOpen] = useState(false);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  // Bottom Margin Adjustment State
  const [bottomMargin, setBottomMargin] = useState(() => {
    const saved = localStorage.getItem('bottomMargin');
    return saved ? parseInt(saved, 10) : 60; // Default a bit higher than 0
  });
  const [showMarginLine, setShowMarginLine] = useState(false);
  const marginDragRef = useRef(false);

  const updateMarginFromClientY = (clientY: number) => {
    if (!editorContainerRef.current || !textareaRef.current) return;
    const rect = editorContainerRef.current.getBoundingClientRect();
    // Distance from bottom of container to mouse / touch point
    const newBottomMargin = rect.bottom - clientY;
    // Limit margin between 0 and 80% of height
    const clampedMargin = Math.max(0, Math.min(newBottomMargin, rect.height * 0.8));
    
    const textarea = textareaRef.current;
    const isAtBottom = textarea.scrollTop + textarea.clientHeight >= textarea.scrollHeight - 50;

    setBottomMargin(prev => {
      const delta = clampedMargin - prev;
      if (isAtBottom && delta > 0) {
        // Force scroll to follow the margin increase
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.scrollTop += delta;
          }
        });
      }
      return clampedMargin;
    });
  };

  const handleMarginMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    marginDragRef.current = true;
    setShowMarginLine(true);
    updateMarginFromClientY(e.clientY);
    document.addEventListener('mousemove', handleMarginMouseMove);
    document.addEventListener('mouseup', handleMarginMouseUp);
  };

  const handleMarginMouseMove = (e: MouseEvent) => {
    if (!marginDragRef.current) return;
    updateMarginFromClientY(e.clientY);
  };

  const handleMarginMouseUp = () => {
    marginDragRef.current = false;
    setShowMarginLine(false);
    document.removeEventListener('mousemove', handleMarginMouseMove);
    document.removeEventListener('mouseup', handleMarginMouseUp);
  };

  const handleMarginTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      marginDragRef.current = true;
      setShowMarginLine(true);
      updateMarginFromClientY(e.touches[0].clientY);
      document.addEventListener('touchmove', handleMarginTouchMove, { passive: false });
      document.addEventListener('touchend', handleMarginTouchEnd);
      document.addEventListener('touchcancel', handleMarginTouchEnd);
    }
  };

  const handleMarginTouchMove = (e: TouchEvent) => {
    if (!marginDragRef.current) return;
    if (e.touches.length > 0) {
      if (e.cancelable) {
        e.preventDefault();
      }
      updateMarginFromClientY(e.touches[0].clientY);
    }
  };

  const handleMarginTouchEnd = () => {
    marginDragRef.current = false;
    setShowMarginLine(false);
    document.removeEventListener('touchmove', handleMarginTouchMove);
    document.removeEventListener('touchend', handleMarginTouchEnd);
    document.removeEventListener('touchcancel', handleMarginTouchEnd);
  };

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMarginMouseMove);
      document.removeEventListener('mouseup', handleMarginMouseUp);
      document.removeEventListener('touchmove', handleMarginTouchMove);
      document.removeEventListener('touchend', handleMarginTouchEnd);
      document.removeEventListener('touchcancel', handleMarginTouchEnd);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('bottomMargin', bottomMargin.toString());
  }, [bottomMargin]);

  // Selection Toolbar State
  const [selectionToolbar, setSelectionToolbar] = useState<{
    show: boolean;
    text: string;
    x: number;
    y: number;
    start: number;
    end: number;
  }>({ show: false, text: '', x: 0, y: 0, start: 0, end: 0 });

  // Autocomplete State
  const [autocomplete, setAutocomplete] = useState<{
    visible: boolean;
    query: string;
    pos: { top: number; left: number };
    triggerType: 'symbol' | 'hotkey';
    isFlipped: boolean;
    startIndex: number; // Position where '*' or hotkey was triggered
  }>({
    visible: false,
    query: '',
    pos: { top: 0, left: 0 },
    triggerType: 'symbol',
    isFlipped: false,
    startIndex: 0
  });

  const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    checkUndoRedoStatus();
    const textarea = e.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    if (start !== end) {
      const selectedText = textarea.value.substring(start, end);
      if (selectedText.trim()) {
        // Use the middle of selection for position
        const middle = Math.floor((start + end) / 2);
        const pos = getCoordinatesForPosition(middle);
        
        setSelectionToolbar({
          show: true,
          text: selectedText,
          x: pos.left,
          y: pos.top,
          start,
          end
        });
      } else {
        setSelectionToolbar(prev => ({ ...prev, show: false }));
      }
    } else {
      if (selectionToolbar.show) {
        setSelectionToolbar(prev => ({ ...prev, show: false }));
      }
    }
  };

  const handleSelectionToolbarAction = async (action: 'add-left' | 'add-right' | 'insert-last' | 'paste') => {
    if (!textareaRef.current) return;
    
    const selectedText = selectionToolbar.text;
    const start = selectionToolbar.start;
    const end = selectionToolbar.end;

    switch (action) {
      case 'add-left':
        handleToolbarAddToClip('clipListLeft', 'ซ้าย', selectedText);
        break;
      case 'add-right':
        handleToolbarAddToClip('clipList', 'ขวา', selectedText);
        break;
      case 'insert-last':
        handleToolbarInsertLastLine(selectedText);
        break;
      case 'paste':
        try {
          const clipText = await navigator.clipboard.readText();
          if (clipText) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(start, end);
            insertTextAtCursor(clipText);
          }
        } catch (err) {
          showAlert("ไม่สามารถอ่านคลิปบอร์ดได้");
        }
        break;
    }
    setSelectionToolbar(prev => ({ ...prev, show: false }));
  };

  const handleToolbarAddToClip = (storageKey: string, sideName: string, textToClip: string) => {
    const savedItems = localStorage.getItem(storageKey);
    let items: any[] = [];
    if (savedItems) {
      try { items = JSON.parse(savedItems); } catch (e) {}
    }
    
    const lines = textToClip.split(/\r?\n|\r/);
    lines.forEach(line => {
      const subItems = line.split(/(?<=:)/);
      subItems.forEach(subItem => {
        if (subItem.trim() !== '') {
          items.push({
            id: `item-${Date.now()}-${Math.random()}`,
            text: subItem
          });
        }
      });
    });

    localStorage.setItem(storageKey, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent(`clipboard-update-${storageKey}`));
    showAlert(`เพิ่มลงคลิปบอร์ด${sideName}แล้ว!`);
  };

  const handleToolbarInsertLastLine = (textToInsert: string) => {
    if (!textareaRef.current) return;
    
    const currentText = textareaRef.current.value;
    const isNameFormat = textToInsert.includes(':');

    if (isNameFormat) {
      const endPos = currentText.length;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(endPos, endPos);
      handlePasteFromClipboard(textToInsert);
    } else {
      let insertPos = currentText.length;
      for (let i = currentText.length - 1; i >= 0; i--) {
        if (currentText[i].trim() !== '') {
          insertPos = i + 1;
          break;
        }
      }
      
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(insertPos, insertPos);
      
      const formatted = (insertPos > 0 && currentText[insertPos - 1] !== ' ' && currentText[insertPos - 1] !== '\n') 
        ? " " + textToInsert 
        : textToInsert;
        
      insertTextAtCursor(formatted);
    }
  };

  const getCoordinatesForPosition = (pos: number) => {
    const textarea = textareaRef.current;
    if (!textarea) return { top: 0, left: 0 };

    const textBefore = textarea.value.substring(0, pos);
    
    const div = document.createElement('div');
    const styles = window.getComputedStyle(textarea);
    const properties = [
      'direction', 'boxSizing', 'width', 'height', 'overflowX', 'overflowY',
      'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderStyle',
      'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
      'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize', 'fontSizeAdjust', 'lineHeight', 'fontFamily',
      'textAlign', 'textTransform', 'textIndent', 'textDecoration', 'letterSpacing', 'wordSpacing', 'tabSize', 'MozTabSize'
    ];
    properties.forEach(prop => {
        // @ts-ignore
        div.style[prop] = styles[prop];
    });

    div.style.position = 'absolute';
    div.style.visibility = 'hidden';
    div.style.whiteSpace = 'pre-wrap';
    div.style.wordWrap = 'break-word';
    div.style.top = '0';
    div.style.left = '0';
    div.textContent = textBefore;
    
    const span = document.createElement('span');
    span.textContent = textarea.value.substring(pos, pos + 1) || '.';
    div.appendChild(span);

    document.body.appendChild(div);
    const { offsetLeft: spanLeft, offsetTop: spanTop } = span;
    const rect = textarea.getBoundingClientRect();
    
    const top = rect.top + spanTop - textarea.scrollTop + window.scrollY;
    const left = rect.left + spanLeft - textarea.scrollLeft + window.scrollX;
    
    document.body.removeChild(div);
    return { top, left };
  };

  const getCaretCoordinates = () => {
    const textarea = textareaRef.current;
    if (!textarea) return { top: 0, left: 0 };
    const pos = getCoordinatesForPosition(textarea.selectionStart);
    const rect = textarea.getBoundingClientRect();
    return { top: pos.top, left: Math.min(pos.left, rect.right - 200) };
  };

  const handleAutocompleteClose = () => {
    setAutocomplete(prev => ({ ...prev, visible: false }));
    // Force focus back to textarea
    setTimeout(() => {
        if (textareaRef.current) {
            textareaRef.current.focus();
        }
    }, 0);
  };

  const handleAutocompleteSelect = (name: string) => {
    if (!textareaRef.current) return;

    const { startIndex } = autocomplete;
    const cursor = textareaRef.current.selectionStart;
    
    let displayName = name;
    
    // Format name: 2 spaces between name and surname, 3 spaces after colon
    const parts = displayName.split(':');
    let namePart = parts[0].trim();
    
    // Ensure 2 spaces between name and surname (the last space in the name part)
    const nameTokens = namePart.split(/\s+/);
    if (nameTokens.length >= 2) {
        const surname = nameTokens.pop();
        const rest = nameTokens.join(' ');
        namePart = `${rest}  ${surname}`;
    }
    
    displayName = `${namePart}   :   `;

    const value = textareaRef.current.value;
    
    // Check if the current line is effectively empty (except for the trigger)
    const lastNewLine = value.lastIndexOf('\n', startIndex - 1);
    const lineStart = lastNewLine === -1 ? 0 : lastNewLine + 1;
    
    const lineBeforeTrigger = value.substring(lineStart, startIndex);
    const isLineEmpty = lineBeforeTrigger.trim() === '';

    let textToInsert = displayName;
    if (isLineEmpty) {
      textToInsert = "\t\t" + textToInsert;
    } else {
      textToInsert = "\n\t\t" + textToInsert;
    }
    
    // To support undo, we select the range to be replaced and use insertTextAtCursor
    textareaRef.current.focus();
    // If it's empty line, we might want to replace from line start
    const replaceStart = isLineEmpty ? lineStart : startIndex;
    textareaRef.current.setSelectionRange(replaceStart, cursor);
    
    insertTextAtCursor(textToInsert);

    setAutocomplete(prev => ({ ...prev, visible: false }));
  };

  const handleRenameSpeaker = (oldName: string, newName: string) => {
    setText(prev => {
      // Escape for regex and ensure we only match the speaker tag format
      // Pattern: start or newline + optional tabs + name + optional spaces + ":"
      const escapedOld = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(^|\\n)(\\t*)${escapedOld}(\\s*):`, 'g');
      return prev.replace(regex, (match, p1, p2, p3) => {
        return `${p1}${p2}${newName}${p3}:`;
      });
    });
    showAlert(`เปลี่ยนชื่อผู้พูดจาก "${oldName}" เป็น "${newName}" แล้ว`);
  };

  const lastInterimLengthRef = useRef(0);

  const appendTextToEnd = (textToAppend: string, isInterim: boolean = false, isSilent: boolean = false) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Capture state BEFORE update
    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    const isAtEnd = selectionStart === text.length;
    const scrollPos = textarea.scrollTop;

    setText(prev => {
      // 1. Remove the previous interim segment if one exists
      const baseText = prev.substring(0, prev.length - lastInterimLengthRef.current);
      
      // 2. Determine the appropriate separator
      let separator = "";
      // Only add separator if we are NOT in the middle of an interim update 
      // and we are starting a new segment.
      if (lastInterimLengthRef.current === 0 && baseText && !baseText.endsWith(" ") && !baseText.endsWith("\n") && !textToAppend.startsWith(" ") && !textToAppend.startsWith("\n")) {
        separator = " ";
      }
      
      const updatedText = baseText + separator + textToAppend;
      
      // 3. Update the interim length tracker
      lastInterimLengthRef.current = isInterim ? textToAppend.length + separator.length : 0;
      
      return updatedText;
    });

    // Restore state AFTER update
    if (isSilent) {
      // If the cursor was at the end, let it follow the new text
      if (isAtEnd) {
        pendingCursorRestore.current = null; // Don't use ref, let it fall through or handle manually
        setTimeout(() => {
          if (textareaRef.current) {
            const newPos = textareaRef.current.value.length;
            textareaRef.current.setSelectionRange(newPos, newPos);
            // Ensure we scroll to show the caret
            textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
          }
        }, 0);
      } else {
        // User is editing elsewhere, preserve their position
        pendingCursorRestore.current = {
          start: selectionStart,
          end: selectionEnd,
          scroll: scrollPos
        };
      }
    } else {
      // Manual trigger: focus and jump to end
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const endPos = textareaRef.current.value.length;
          textareaRef.current.setSelectionRange(endPos, endPos);
          textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
        }
      }, 0);
    }
  };

  // Menu States
  const [isCopyMenuOpen, setIsCopyMenuOpen] = useState(false);
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const [isMenuBarCollapsed, setIsMenuBarCollapsed] = useState(() => {
    return localStorage.getItem('isMenuBarCollapsed') === 'true';
  });

  const toggleMenuBar = () => {
    setIsMenuBarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('isMenuBarCollapsed', String(next));
      return next;
    });
  };

  const copyMenuRef = useRef<HTMLDivElement>(null);
  const toolsMenuRef = useRef<HTMLDivElement>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);

  const [senatorList, setSenatorList] = useState<string[]>(() => {
    const saved = localStorage.getItem('senatorList');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return ['นายมงคล สุระสัจจะ', 'พลเอก เกรียงไกร ศรีรักษ์', 'นายบุญส่ง น้อยโสภณ', ...SENATORS_200.filter(name => !['นายมงคล สุระสัจจะ', 'พลเอก เกรียงไกร ศรีรักษ์', 'นายบุญส่ง น้อยโสภณ'].includes(name))];
  });
  const [speakerList, setSpeakerList] = useState<string[]>(() => {
    const saved = localStorage.getItem('speakerList');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return ['นายกิตติศักดิ์ รัตนวราหะ', 'นายเสรี สุวรรณภานนท์', 'นายถวิล เปลี่ยนศรี'];
  });

  // Committee Speaker State
  const [committeeList, setCommitteeList] = useState<string[]>(() => {
    const saved = localStorage.getItem('committeeList');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });
  const [committeeSpeakerList, setCommitteeSpeakerList] = useState<string[]>(() => {
    const saved = localStorage.getItem('committeeSpeakerList');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  // Persist speaker lists
  useEffect(() => {
    localStorage.setItem('senatorList', JSON.stringify(senatorList));
  }, [senatorList]);

  useEffect(() => {
    localStorage.setItem('speakerList', JSON.stringify(speakerList));
  }, [speakerList]);

  useEffect(() => {
    localStorage.setItem('committeeList', JSON.stringify(committeeList));
  }, [committeeList]);

  useEffect(() => {
    localStorage.setItem('committeeSpeakerList', JSON.stringify(committeeSpeakerList));
  }, [committeeSpeakerList]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.show) {
        setContextMenu(prev => ({ ...prev, show: false }));
      }
      if (isSpeakerMenuOpen && speakerMenuRef.current && !speakerMenuRef.current.contains(document.activeElement)) {
        // We handle this with a specific click listener below
      }
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [contextMenu.show, isSpeakerMenuOpen]);

  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      if (isCopyMenuOpen && copyMenuRef.current && !copyMenuRef.current.contains(e.target as Node)) {
        setIsCopyMenuOpen(false);
      }
      if (isSpeakerMenuOpen && speakerMenuRef.current && !speakerMenuRef.current.contains(e.target as Node)) {
        setIsSpeakerMenuOpen(false);
      }
      if (isToolsMenuOpen && toolsMenuRef.current && !toolsMenuRef.current.contains(e.target as Node)) {
        setIsToolsMenuOpen(false);
      }
      if (isSettingsMenuOpen && settingsMenuRef.current && !settingsMenuRef.current.contains(e.target as Node)) {
        setIsSettingsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, [isCopyMenuOpen, isSpeakerMenuOpen, isToolsMenuOpen, isSettingsMenuOpen]);

  // Load text and settings from resilient persistent storage (IndexedDB + localStorage)
  useEffect(() => {
    // 1. Request persistent storage on iPad / Safari / Chrome to prevent automatic cache purge
    requestPersistentStorage();

    // 2. Load text from storage safely
    const loadPersistedText = async () => {
      try {
        const saved = await getItem('savedText');
        if (saved !== null && saved !== undefined && saved.trim().length > 0) {
          setText(saved);
          lastSnapshotTextRef.current = saved;
          setUserClearedState(false);
          saveEmergencyBackup(saved, 'initial_load');
        } else {
          // Check for Post-Eviction Data Loss (Browser / OS wiped memory or storage)
          const { isEvicted, backupData } = await checkPostEvictionDataLoss(saved);
          if (isEvicted && backupData) {
            setEmergencyBackupData(backupData);
            setIsEmergencyRecoveryOpen(true);
          }
        }
      } catch (err) {
        console.error("Failed to load text from persistent storage", err);
      } finally {
        isLoadedFromStorageRef.current = true;
      }
    };
    loadPersistedText();
    
    const savedFontSize = localStorage.getItem('fontSize');
    if (savedFontSize) {
      setFontSize(parseInt(savedFontSize, 10));
    }

    const savedSnippets = localStorage.getItem('customSnippets');
    if (savedSnippets) {
      try {
        setCustomSnippets(JSON.parse(savedSnippets));
      } catch (e) {
        console.error("Failed to parse saved snippets", e);
        setCustomSnippets(defaultSnippets);
      }
    }

    const savedShortcuts = localStorage.getItem('customShortcuts');
    if (savedShortcuts) {
      try {
        let loadedShortcuts = JSON.parse(savedShortcuts);
        // Migration logic for old 'insert' action
        loadedShortcuts = loadedShortcuts.map((s: any) => {
             if (s.action === 'insert') {
                 return { ...s, action: 'insert_speaker' };
             }
             return s;
        });
        
        // Add new default speech shortcuts if they don't exist in saved shortcuts
        const existingActions = new Set(loadedShortcuts.map((s: any) => s.action));
        defaultShortcuts.forEach(def => {
          if (!existingActions.has(def.action)) {
            loadedShortcuts.push(def);
          }
        });
        
        setShortcuts(loadedShortcuts);
      } catch (e) {
        console.error("Failed to parse saved shortcuts", e);
        setShortcuts(defaultShortcuts);
      }
    }
  }, []);

  // Save text to persistent storage with debounce (Guarded against empty state overwrite)
  useEffect(() => {
    if (!isLoadedFromStorageRef.current) return;

    setHasUnsavedChanges(true);
    setIsSaving(true);
    const timeoutId = setTimeout(() => {
      setItem('savedText', text);
      setIsSaving(false);
      setHasUnsavedChanges(false);

      // If user typed content, clear user-cleared flag and ensure emergency backup
      if (text.trim().length > 0) {
        setUserClearedState(false);
        saveEmergencyBackup(text, 'auto_save');
      }

      // Periodically record local snapshots to IndexedDB if text has meaningful changes
      const textLen = text.trim().length;
      const prevLen = lastSnapshotTextRef.current.trim().length;
      const now = Date.now();
      if (textLen > 10 && (Math.abs(textLen - prevLen) > 20 || (now - lastSnapshotTimeRef.current > 30000 && text !== lastSnapshotTextRef.current))) {
        saveTextSnapshot(text);
        lastSnapshotTextRef.current = text;
        lastSnapshotTimeRef.current = now;
      }
    }, 400); // Debounce for 400ms
    
    return () => clearTimeout(timeoutId);
  }, [text]);

  // Flush text on iPad app switch / Safari tab backgrounding / pagehide
  useEffect(() => {
    const handleImmediateFlush = () => {
      if (isLoadedFromStorageRef.current && textareaRef.current) {
        const val = textareaRef.current.value;
        if (val !== undefined) {
          try {
            localStorage.setItem('savedText', val);
          } catch (_) {}
          setItem('savedText', val);
          if (val.trim().length > 0) {
            saveEmergencyBackup(val, 'lifecycle_event');
          }
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleImmediateFlush();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handleImmediateFlush);
    window.addEventListener('beforeunload', handleImmediateFlush);

    return () => {
      window.removeEventListener('visibilitychange', handleImmediateFlush);
      window.removeEventListener('pagehide', handleImmediateFlush);
      window.removeEventListener('beforeunload', handleImmediateFlush);
    };
  }, []);

  // Save font size when changed
  useEffect(() => {
    localStorage.setItem('fontSize', fontSize.toString());
  }, [fontSize]);

  const handleSaveSnippets = (newSnippets: Snippet[]) => {
    setCustomSnippets(newSnippets);
    localStorage.setItem('customSnippets', JSON.stringify(newSnippets));
    showAlert("บันทึกคำย่อเรียบร้อยแล้ว!");
  };

  const handleSaveShortcuts = (newShortcuts: ShortcutConfig[]) => {
    setShortcuts(newShortcuts);
    localStorage.setItem('customShortcuts', JSON.stringify(newShortcuts));
    showAlert("บันทึกคีย์ลัดเรียบร้อยแล้ว!");
  };

  const handleUndo = () => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      document.execCommand('undo');
      // Trigger update
      setTimeout(checkUndoRedoStatus, 0);
    }
  };

  const handleRedo = () => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      document.execCommand('redo');
      // Trigger update
      setTimeout(checkUndoRedoStatus, 0);
    }
  };

  const handleIncreaseFontSize = () => {
    setFontSize(prev => Math.min(prev + 2, 32));
  };

  const handleDecreaseFontSize = () => {
    setFontSize(prev => Math.max(prev - 2, 12));
  };

  // Handle initial responsive state
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 600) {
        // Only auto-close on resize if we want that behavior, 
        // but typically we just set initial state.
        // However, the original CSS handles layout changes.
        // Let's just ensure if we switch to mobile it doesn't cover everything unless requested.
        // For now, just setting initial state is enough.
      }
      
      if (editorContainerRef.current) {
        setClipboardHeight(editorContainerRef.current.offsetHeight);
      }
    };

    // Set initial state based on width
    if (window.innerWidth <= 600) {
      setIsClipboardOpen(false);
      setIsLeftClipboardOpen(false);
    }

    window.addEventListener('resize', handleResize);
    handleResize(); // Call once to set height

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    checkUndoRedoStatus();
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    // Update autocomplete query if visible
    if (autocomplete.visible && autocomplete.triggerType === 'symbol') {
        const query = value.substring(autocomplete.startIndex + 1, cursorPos);
        // If user deleted the trigger symbol, close it
        if (value[autocomplete.startIndex] !== '/') {
            setAutocomplete(prev => ({ ...prev, visible: false }));
        } else {
            setAutocomplete(prev => ({ ...prev, query }));
        }
    } else if (autocomplete.visible && autocomplete.triggerType === 'hotkey') {
        const query = value.substring(autocomplete.startIndex, cursorPos);
        setAutocomplete(prev => ({ ...prev, query }));
    }

    // Auto-complete logic for snippets
    const textBeforeCursor = value.substring(0, cursorPos);
    // Split by whitespace to get the last word
    const words = textBeforeCursor.split(/\s+/);
    const lastWord = words[words.length - 1];

    // Create a map from customSnippets
    const replacementWords: { [key: string]: string } = {};
    customSnippets.forEach(snippet => {
      replacementWords[snippet.abbr] = snippet.fullText;
    });

    if (lastWord in replacementWords) {
      const replacement = replacementWords[lastWord];
      const newText = value.substring(0, cursorPos - lastWord.length) + replacement + value.substring(cursorPos);
      
      setText(newText);
      
      // We need to set cursor position after render
      setTimeout(() => {
        if (textareaRef.current) {
          const newCursorPos = cursorPos - lastWord.length + replacement.length;
          textareaRef.current.selectionStart = newCursorPos;
          textareaRef.current.selectionEnd = newCursorPos;
        }
      }, 0);
    } else {
      setText(value);
    }
  };

  const showAlert = (msg: string) => {
    const statusElement = document.createElement("div");
    statusElement.textContent = msg;
    statusElement.classList.add("status-bar");
    document.body.appendChild(statusElement);

    setTimeout(() => {
      statusElement.style.display = "none";
      if (document.body.contains(statusElement)) {
        document.body.removeChild(statusElement);
      }
    }, 7000);
  };

  const handleConvert = () => {
    let newText = arabicNumberToThaiNumberAndReplace(text);
    newText = processPlusSigns(newText);
    setText(newText);
    showAlert("แก้ไขข้อความเรียบร้อยแล้ว!");
  };

  const handleCheckErrors = () => {
    const message = findAndAlertErrors(text);
    alert(message);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      showAlert("คัดลอกข้อความทั้งหมดแล้ว!");
    } catch (err) {
      console.error('Failed to copy text: ', err);
      // Fallback
      if (textareaRef.current) {
        const start = textareaRef.current.selectionStart;
        const end = textareaRef.current.selectionEnd;
        textareaRef.current.select();
        document.execCommand('copy');
        textareaRef.current.setSelectionRange(start, end);
        showAlert("คัดลอกข้อความทั้งหมดแล้ว!");
      }
    }
  };

  const handleCopyAllClipboardNames = async () => {
    // Left clipboard title & items
    const leftTitle = localStorage.getItem('clipListLeft_title') || 'Clipboard (L)';
    let leftItems: string[] = [];
    const rawLeft = localStorage.getItem('clipListLeft');
    if (rawLeft) {
      try {
        const parsed = JSON.parse(rawLeft);
        leftItems = parsed
          .map((item: any) => {
            const txt = typeof item === 'string' ? item : item?.text ?? '';
            return txt.trimStart();
          })
          .filter((t: string) => t.length > 0);
      } catch (e) {
        console.error("Failed to parse left clipboard items", e);
      }
    }

    // Right clipboard title & items
    const rightTitle = localStorage.getItem('clipList_title') || 'Clipboard (R)';
    let rightItems: string[] = [];
    const rawRight = localStorage.getItem('clipList');
    if (rawRight) {
      try {
        const parsed = JSON.parse(rawRight);
        rightItems = parsed
          .map((item: any) => {
            const txt = typeof item === 'string' ? item : item?.text ?? '';
            return txt.trimStart();
          })
          .filter((t: string) => t.length > 0);
      } catch (e) {
        console.error("Failed to parse right clipboard items", e);
      }
    }

    const leftFormatted = [`[${leftTitle}]`, ...leftItems].join('\n');
    const rightFormatted = [`[${rightTitle}]`, ...rightItems].join('\n');
    const combinedText = `${leftFormatted}\n\n${rightFormatted}`;

    try {
      await navigator.clipboard.writeText(combinedText);
      showAlert("คัดลอกข้อความในคลิปบอร์ดซ้ายและขวาเรียบร้อยแล้ว!");
    } catch (err) {
      console.error("Failed to copy clipboard items", err);
      showAlert("ไม่สามารถคัดลอกได้");
    }
  };

  const handleClear = async () => {
    if (isConfirmingClear) {
      const textToClear = text;
      setText('');
      await clearActiveText(textToClear);
      setIsConfirmingClear(false);
      showAlert("ล้างข้อความแล้ว (คุณสามารถเปิดดูประวัติย้อนหลังหรือกดกู้คืนได้ที่ปุ่มประวัติ)");
    } else {
      setIsConfirmingClear(true);
      setTimeout(() => setIsConfirmingClear(false), 3000); // Reset after 3 seconds
    }
  };

  const scrollCaretIntoView = (targetPos?: number) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const pos = typeof targetPos === 'number' ? targetPos : textarea.selectionEnd;
    
    // If caret is at or near the very end of text, scroll all the way down
    if (pos >= textarea.value.length) {
      textarea.scrollTop = textarea.scrollHeight;
      return;
    }

    try {
      const div = document.createElement('div');
      const styles = window.getComputedStyle(textarea);
      const properties = [
        'direction', 'boxSizing', 'width', 'overflowX', 'overflowY',
        'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderStyle',
        'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
        'fontStyle', 'fontVariant', 'fontWeight', 'fontStretch', 'fontSize', 'fontSizeAdjust', 'lineHeight', 'fontFamily',
        'textAlign', 'textTransform', 'textIndent', 'textDecoration', 'letterSpacing', 'wordSpacing', 'tabSize', 'MozTabSize'
      ];
      properties.forEach(prop => {
        // @ts-ignore
        div.style[prop] = styles[prop];
      });

      div.style.position = 'absolute';
      div.style.visibility = 'hidden';
      div.style.whiteSpace = 'pre-wrap';
      div.style.wordWrap = 'break-word';
      div.style.top = '0';
      div.style.left = '0';
      div.textContent = textarea.value.substring(0, pos);
      
      const span = document.createElement('span');
      span.textContent = textarea.value.substring(pos, pos + 1) || ' ';
      div.appendChild(span);

      document.body.appendChild(div);
      const spanTop = span.offsetTop;
      const computedLineHeight = parseFloat(styles.lineHeight) || (fontSize * 1.6);
      document.body.removeChild(div);

      const visibleTop = textarea.scrollTop;
      const visibleBottom = textarea.scrollTop + textarea.clientHeight;
      const caretBottom = spanTop + computedLineHeight;

      // If caret line is below visible area (or touching the bottom margin line)
      if (caretBottom + 20 > visibleBottom) {
        textarea.scrollTop = caretBottom + 35 - textarea.clientHeight;
      } else if (spanTop - 20 < visibleTop) {
        textarea.scrollTop = Math.max(0, spanTop - 20);
      }
    } catch (e) {
      // Fallback
      if (pos >= textarea.value.length - 100) {
        textarea.scrollTop = textarea.scrollHeight;
      }
    }
  };

  const insertTextAtCursor = (textToInsert: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.focus();
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    // 1. Try document.execCommand('insertText') - most compatible for undo
    let success = false;
    try {
      success = document.execCommand('insertText', false, textToInsert);
    } catch (e) {
      console.error('execCommand failed', e);
    }

    // 2. Fallback: Native property setter hack to trigger React's onChange and preserve undo
    if (!success) {
      try {
        const value = textarea.value;
        const newValue = value.substring(0, start) + textToInsert + value.substring(end);
        
        const nativePropertyValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
        if (nativePropertyValueSetter) {
          nativePropertyValueSetter.call(textarea, newValue);
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          success = true;
          
          // Restore cursor
          const newPos = start + textToInsert.length;
          textarea.setSelectionRange(newPos, newPos);
        }
      } catch (e) {
        console.error('Native setter fallback failed', e);
      }
    }

    // 3. Ultimate Fallback (Breaks undo history but ensures text is updated)
    if (!success) {
      const val = textarea.value;
      const newText = val.substring(0, start) + textToInsert + val.substring(end);
      setText(newText);
      
      setTimeout(() => {
        if (textareaRef.current) {
          const newCursorPos = start + textToInsert.length;
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    }

    // Auto-scroll to ensure caret and inserted text are immediately visible above bottom margin
    const targetCursorPos = textarea.selectionEnd;
    scrollCaretIntoView(targetCursorPos);

    setTimeout(() => {
      if (textareaRef.current) {
        scrollCaretIntoView(textareaRef.current.selectionEnd);
      }
    }, 0);

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        scrollCaretIntoView(textareaRef.current.selectionEnd);
      }
    });
  };

  const handlePasteFromClipboard = (itemText: string) => {
    if (!textareaRef.current) return;

    // Update recent speakers logic
    const speakerName = itemText.trim();
    setRecentSpeakers(prev => {
      // If already in list, move to end (most recent)
      const filtered = prev.filter(s => s !== speakerName);
      const updated = [...filtered, speakerName];
      // Keep only last 2
      return updated.slice(-2);
    });
    setLastActiveSpeaker(speakerName);

    const val = textareaRef.current.value;
    const cursor = textareaRef.current.selectionStart;
    
    // Find start and end of current line
    const lastNewLine = val.lastIndexOf('\n', cursor - 1);
    const lineStart = lastNewLine === -1 ? 0 : lastNewLine + 1;
    const nextNewLine = val.indexOf('\n', cursor);
    const lineEnd = nextNewLine === -1 ? val.length : nextNewLine;
    
    const currentLine = val.substring(lineStart, lineEnd);
    const isLineEmpty = currentLine.trim() === '';

    let textToInsert = itemText.trim();
    if (itemText.trim().endsWith(":")) {
      textToInsert += "   ";
    }

    if (isLineEmpty) {
      textToInsert = "\t\t" + textToInsert;
    } else {
      textToInsert = "\n\t\t" + textToInsert;
    }

    insertTextAtCursor(textToInsert);
  };

  const handleSwitchSpeaker = () => {
    if (!textareaRef.current) return;

    const val = textareaRef.current.value;
    const cursor = textareaRef.current.selectionStart;

    // Look back to find the previous speakers
    const textBeforeCursor = val.substring(0, cursor);
    const lines = textBeforeCursor.split('\n');
    
    // Set to store unique speakers found, preserving order (most recent first)
    const foundSpeakers = new Set<string>();
    
    // Regex to identify a speaker line: looks for text ending with ":" possibly with spaces
    // This matches patterns like "นาย ก   :   ", "ประธาน   :", etc.
    // We assume a speaker line usually has some indentation or is at the start, and ends with a colon.
    // Adjust regex as needed to match your specific format strictly or loosely.
    // Here we look for a line that has non-whitespace content and ends with a colon (and optional spaces).
    const speakerRegex = /^(?:\\t| )*(.+?)\s*:\s*$/;

    // Iterate backwards through lines to find speakers
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      // We need to check if the line LOOKS like a speaker line.
      // Since your format uses "Name   :   ", we can look for the colon.
      
      // Simple check: does it contain a colon?
      if (line.includes(':')) {
         // Try to extract the name part. 
         // Assuming format is "\t\tName   :   " or similar.
         const parts = line.split(':');
         if (parts.length >= 2) {
             // The part before the colon is likely the name
             let potentialName = parts[0].trim();
             
             // If the line has multiple colons, this might be tricky, but usually speaker format is at the start.
             // Let's assume the speaker name is the whole part before the *last* colon if we want to be safe,
             // or just the first part. Given "Name : Message", it's the first part.
             // Given "Name   :   ", it's also the first part.
             
             // Reconstruct the full speaker string as it would be pasted (Name + "   :   ")
             // actually, we just want to switch to the *full string* that represents the speaker.
             // But wait, if we use the clipboard logic, we need the exact string.
             // If we just want to insert the name, we need to know what the "other" speaker is.
             
             // Let's capture the whole line content that represents the speaker tag.
             // If the line is just "Name : ", then that's the speaker tag.
             // If the line is "Name : Hello", we only want "Name : ".
             
             // Strategy: Check if the line *is* just a speaker tag (possibly with whitespace).
             // Or if it's a dialogue line, extract the speaker.
             
             // Your format seems to be: "\t\tName   :   " followed by text or newline.
             // If the user typed "ป.." -> "ประธาน   :   "
             
             // Let's try to match the standard suffix "   :   " or just " : ".
             const match = line.match(/^(.*?)(\s*:\s*)/);
             if (match) {
                 // match[0] is the whole "Name : " part.
                 // We want to reuse this exact string to be consistent.
                 const speakerTag = match[0].trim(); // "Name :"
                 
                 // We need to normalize or keep it as is. 
                 // Let's store the full trimmed line if it's short enough to be a name,
                 // or just the prefix.
                 
                 // Better approach: Just find the last 2 unique lines that contain a colon.
                 // And assume the part before the message is the speaker.
                 
                 // Let's use the full prefix including the colon.
                 // e.g. "นาย ก   :   "
                 
                 // If the line has text after the colon, we need to be careful.
                 // e.g. "นาย ก : สวัสดี" -> Speaker is "นาย ก : "
                 
                 // Let's assume the speaker part ends at the first colon sequence that has spaces around it or is at the end.
                 
                 // Heuristic: The speaker name usually doesn't differ much.
                 // Let's just grab everything up to the colon + the colon itself.
                 const colIndex = line.indexOf(':');
                 // Include the colon and any spaces immediately following it? 
                 // Your clipboard paste adds "   " after colon if missing.
                 // Your auto-replace adds "   :   ".
                 
                 // Let's try to extract "Name   :   "
                 // We will look for the substring that matches the speaker format.
                 
                 // If we find a line with a colon, we treat the part up to the colon as the key.
                 const namePart = line.substring(0, colIndex + 1); // "......:"
                 
                 // We need to construct the "pasteable" text.
                 // If we just found "Name:", we might want to append "   ".
                 // But if the user manually typed it, it might differ.
                 
                 // Let's try to find the *exact string* used for that speaker if possible.
                 // But we can't know for sure.
                 
                 // Let's just use the name part + "   ".
                 let speakerStr = namePart.trim();
                 if (!speakerStr.endsWith("   ")) {
                     speakerStr += "   ";
                 }
                 
                 foundSpeakers.add(speakerStr);
             }
         }
      }
      
      if (foundSpeakers.size >= 2) break;
    }

    const speakers = Array.from(foundSpeakers);

    if (speakers.length === 0) {
        showAlert("ไม่พบชื่อผู้พูดก่อนหน้าครับ");
        return;
    }

    // Logic:
    // If we found 1 speaker (the most recent one), we can't switch.
    // If we found 2 speakers (recent, and previous), we want to insert the *previous* one (to switch back).
    // Wait, if I just typed "A:", now I want "B:".
    // The search finds A (most recent). It might find B (before A).
    // So speakers[0] is A, speakers[1] is B.
    // We want to insert B.
    
    let nextSpeaker;
    if (speakers.length >= 2) {
        nextSpeaker = speakers[1]; // The one before the last one
    } else {
        // Only 1 speaker found. We can't switch.
        // Unless we have history in recentSpeakers? 
        // The user said "don't care about selecting 2 speakers first".
        // So we rely purely on text content.
        showAlert("พบผู้พูดคนเดียว ไม่สามารถสลับได้ครับ");
        return;
    }
       
    handlePasteFromClipboard(nextSpeaker);
  };

  // Global Keyboard Shortcuts (Alt + Key)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Must have Alt key pressed, and no Ctrl/Meta modifiers
      if (!e.altKey || e.ctrlKey || e.metaKey) return;

      // Don't intercept if user is recording a new keycode in ShortcutManager
      if (isShortcutManagerOpen) return;

      // Match shortcut by keyCode, displayKey, or key
      const matchedShortcut = shortcuts.find(s => {
        if (!s) return false;
        const codeMatch = s.keyCode && e.code && s.keyCode.toLowerCase() === e.code.toLowerCase();
        const keyMatch = s.displayKey && e.key && s.displayKey.toLowerCase() === e.key.toLowerCase();
        const codeDisplayMatch = s.displayKey && e.code && `key${s.displayKey.toLowerCase()}` === e.code.toLowerCase();
        return Boolean(codeMatch || keyMatch || codeDisplayMatch);
      });

      if (matchedShortcut) {
        e.preventDefault();
        e.stopPropagation();

        if (matchedShortcut.action === 'insert_text' && matchedShortcut.text) {
          insertTextAtCursor(matchedShortcut.text);
        } else if (matchedShortcut.action === 'insert_speaker' && matchedShortcut.text) {
          if (textareaRef.current) {
            const val = textareaRef.current.value;
            const cursor = textareaRef.current.selectionStart;
            
            // Find start and end of current line
            const lastNewLine = val.lastIndexOf('\n', cursor - 1);
            const lineStart = lastNewLine === -1 ? 0 : lastNewLine + 1;
            const nextNewLine = val.indexOf('\n', cursor);
            const lineEnd = nextNewLine === -1 ? val.length : nextNewLine;
            
            const currentLine = val.substring(lineStart, lineEnd);
            const isLineEmpty = currentLine.trim() === '';

            let textToInsert = matchedShortcut.text;
            
            if (isLineEmpty) {
              textToInsert = "\t\t" + textToInsert;
            } else {
              textToInsert = "\n\t\t" + textToInsert;
            }
            
            insertTextAtCursor(textToInsert);
          }
        } else if (matchedShortcut.action === 'switch_speaker') {
          handleSwitchSpeaker();
        } else if (matchedShortcut.action === 'toggle_speech') {
          if (!isSpeechTranscriberOpen) {
            setIsSpeechTranscriberOpen(true);
          }
          if (speechTranscriberRef.current) {
            speechTranscriberRef.current.toggleListening();
          }
        } else if (matchedShortcut.action === 'insert_speech_transcript') {
          if (speechTranscriberRef.current) {
            speechTranscriberRef.current.handleInsertText();
          }
        }
      } else if (e.key?.toLowerCase() === 'f' || e.code === 'KeyF') {
        // Alt + F autocomplete trigger
        e.preventDefault();
        e.stopPropagation();
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
        const pos = getCaretCoordinates();
        const windowHeight = window.innerHeight;
        const estimatedHeight = 400;
        
        let top = pos.top + 24;
        let isFlipped = false;
        if (top + estimatedHeight > windowHeight) {
          top = pos.top - 8;
          isFlipped = true;
        }

        setAutocomplete({
          visible: true,
          query: '',
          pos: { top, left: pos.left },
          triggerType: 'hotkey',
          isFlipped: isFlipped,
          startIndex: textareaRef.current ? textareaRef.current.selectionStart : text.length
        });
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [shortcuts, isSpeechTranscriberOpen, isShortcutManagerOpen, text]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    checkUndoRedoStatus();
    if (e.key === 'Tab' && !autocomplete.visible) {
      e.preventDefault();
      insertTextAtCursor('\t');
    } else if (e.key === '/' && !autocomplete.visible) {
        // Check if cursor is at the start of a newline
        const val = e.currentTarget.value;
        const cursor = e.currentTarget.selectionStart;
        const isStartOfLine = cursor === 0 || val[cursor - 1] === '\n';
        
        if (isStartOfLine) {
            // Give a tiny timeout to let the '/' character be inserted 
            setTimeout(() => {
                const pos = getCaretCoordinates();
                const windowHeight = window.innerHeight;
                const estimatedHeight = 400; // Estimated max height of autocomplete
                
                let top = pos.top + 24; // Default to below
                let isFlipped = false;
                if (top + estimatedHeight > windowHeight) {
                    top = pos.top - 8; // Anchor above
                    isFlipped = true;
                }

                setAutocomplete({
                    visible: true,
                    query: '',
                    pos: { top, left: pos.left },
                    triggerType: 'symbol',
                    isFlipped: isFlipped,
                    startIndex: cursor
                });
            }, 0);
        }
    }
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    if (!textareaRef.current) return;
    
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const selectedText = text.substring(start, end);
    
    // Estimate menu dimensions to prevent overflow
    const menuWidth = 220;
    const menuHeight = 280;
    
    let x = e.pageX;
    let y = e.pageY;
    
    const rect = textareaRef.current.getBoundingClientRect();
    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    
    const textareaLeft = rect.left + scrollX;
    const textareaRight = rect.right + scrollX;
    const textareaTop = rect.top + scrollY;
    const textareaBottom = rect.bottom + scrollY;
    
    // Adjust if it goes off the right edge
    if (x + menuWidth > textareaRight) {
      x = textareaRight - menuWidth - 5;
    }
    // Adjust if it goes off the left edge
    if (x < textareaLeft) {
      x = textareaLeft + 5;
    }
    
    // Adjust if it goes off the bottom edge
    if (y + menuHeight > textareaBottom) {
      y = textareaBottom - menuHeight - 5;
    }
    // Adjust if it goes off the top edge
    if (y < textareaTop) {
      y = textareaTop + 5;
    }
    
    setContextMenu({
      show: true,
      x,
      y,
      selectedText,
      selectionStart: start,
      selectionEnd: end
    });
  };

  const handleContextCopy = async () => {
    if (contextMenu.selectedText) {
      try {
        await navigator.clipboard.writeText(contextMenu.selectedText);
        showAlert("คัดลอกข้อความแล้ว!");
      } catch (err) {
        console.error('Failed to copy text: ', err);
        showAlert("ไม่สามารถคัดลอกได้ กรุณากด Ctrl+C (หรือ Cmd+C) แทน");
      }
    }
  };

  const handleContextCut = async () => {
    if (contextMenu.selectedText && textareaRef.current) {
      try {
        await navigator.clipboard.writeText(contextMenu.selectedText);
        
        const newText = text.substring(0, contextMenu.selectionStart) + text.substring(contextMenu.selectionEnd);
        setText(newText);
        
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.selectionStart = contextMenu.selectionStart;
            textareaRef.current.selectionEnd = contextMenu.selectionStart;
            textareaRef.current.focus();
          }
        }, 0);
        showAlert("ตัดข้อความแล้ว!");
      } catch (err) {
        console.error('Failed to cut text: ', err);
        showAlert("ไม่สามารถตัดข้อความได้ กรุณากด Ctrl+X (หรือ Cmd+X) แทน");
      }
    }
  };

  const handleContextPaste = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText && textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(contextMenu.selectionStart, contextMenu.selectionEnd);
        insertTextAtCursor(clipText);
      }
    } catch (err) {
      console.error('Failed to read clipboard contents: ', err);
      showAlert("ไม่สามารถอ่านคลิปบอร์ดได้ กรุณากด Ctrl+V (หรือ Cmd+V) เพื่อวางข้อความแทน");
    }
  };

  const handleContextInsertLastLine = () => {
    if (!contextMenu.selectedText || !textareaRef.current) return;

    const selected = contextMenu.selectedText;
    const isNameFormat = selected.includes(':');
    const currentText = textareaRef.current.value;

    if (isNameFormat) {
      // Move cursor to the end of the document to insert under the latest speaker
      const endPos = currentText.length;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(endPos, endPos);
      
      // Act exactly like clicking clipboard
      handlePasteFromClipboard(selected);
    } else {
      // Normal text: append to the last non-empty line
      
      // Find the index of the last non-whitespace character
      let insertPos = currentText.length;
      for (let i = currentText.length - 1; i >= 0; i--) {
        if (currentText[i].trim() !== '') {
          insertPos = i + 1;
          break;
        }
      }
      
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(insertPos, insertPos);
      
      // Add a space if the last character isn't a space or newline
      const textToInsert = (insertPos > 0 && currentText[insertPos - 1] !== ' ' && currentText[insertPos - 1] !== '\n') 
        ? " " + selected 
        : selected;
        
      const success = document.execCommand('insertText', false, textToInsert);
      
      if (!success) {
        const newText = currentText.substring(0, insertPos) + textToInsert + currentText.substring(insertPos);
        setText(newText);
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.selectionStart = insertPos + textToInsert.length;
            textareaRef.current.selectionEnd = insertPos + textToInsert.length;
            textareaRef.current.focus();
            textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
          }
        }, 0);
      } else {
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
          }
        }, 10);
      }
    }
  };

  const handleContextAddToClip = (storageKey: string, sideName: string) => {
    if (!contextMenu.selectedText) return;
    
    const savedItems = localStorage.getItem(storageKey);
    let items: any[] = [];
    if (savedItems) {
      try { items = JSON.parse(savedItems); } catch (e) {}
    }
    
    const lines = contextMenu.selectedText.split(/\r?\n|\r/);
    lines.forEach(line => {
      const subItems = line.split(/(?<=:)/);
      subItems.forEach(subItem => {
        if (subItem.trim() !== '') {
          items.push({
            id: `item-${Date.now()}-${Math.random()}`,
            text: subItem
          });
        }
      });
    });

    localStorage.setItem(storageKey, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent(`clipboard-update-${storageKey}`));
    showAlert(`เพิ่มข้อความลงคลิปบอร์ด${sideName}แล้ว!`);
    
    if (storageKey === 'clipListLeft' && !isLeftClipboardOpen) setIsLeftClipboardOpen(true);
    if (storageKey === 'clipList' && !isClipboardOpen) setIsClipboardOpen(true);
  };

  // Handle Drag and Drop
  const handleDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedText = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text');
    if (droppedText) {
      insertTextAtCursor(droppedText);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault(); // Necessary to allow dropping
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDragEnter = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  // Editor base styles to ensure identical rendering
  const editorBaseStyles: React.CSSProperties = {
    padding: '30px 24px 20px 24px',
    fontSize: `${fontSize}px`,
    lineHeight: '1.6',
    fontFamily: '"Sarabun", "Inter", sans-serif',
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
    border: 'none',
    outline: 'none',
    resize: 'none',
    width: '100%',
    height: `calc(100% - ${bottomMargin}px)`,
    boxSizing: 'border-box',
    tabSize: 4,
    margin: 0,
    backgroundColor: 'transparent',
    color: '#1f2937',
    overflowY: 'auto',
    scrollbarGutter: 'stable',
    MozOsxFontSmoothing: 'grayscale',
    WebkitFontSmoothing: 'antialiased',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '100dvh', maxHeight: '100dvh', width: '100%', overflow: 'hidden' }}>
      
      {/* Autocomplete Overlay */}
      {autocomplete.visible && (
        <NameAutocomplete 
          query={autocomplete.query}
          position={autocomplete.pos}
          isFlipped={autocomplete.isFlipped}
          onClose={handleAutocompleteClose}
          onSelect={handleAutocompleteSelect}
        />
      )}

      {/* Top Menu Bar */}
      <div 
        style={{ 
          position: 'relative',
          zIndex: 50,
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          padding: isMenuBarCollapsed ? '2px 6px' : '4px 8px', 
          minHeight: isMenuBarCollapsed ? '32px' : '42px',
          backgroundColor: '#f3f4f6', 
          borderBottom: '1px solid #e5e7eb',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          transition: 'all 0.2s ease-in-out',
          overflow: 'visible',
          whiteSpace: 'nowrap',
          width: '100%'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: isMenuBarCollapsed ? '3px' : '6px', flexShrink: 0 }}>
          {/* Save Status Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: isMenuBarCollapsed ? '2px' : '4px', marginRight: isMenuBarCollapsed ? '3px' : '6px' }} className="shrink-0">
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }} title={hasUnsavedChanges ? "Unsaved changes" : "Saved"} className="shrink-0">
              <Save size={isMenuBarCollapsed ? 15 : 17} color="#4b5563" className="shrink-0" />
              {hasUnsavedChanges && (
                <div style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  width: isMenuBarCollapsed ? '6px' : '7px',
                  height: isMenuBarCollapsed ? '6px' : '7px',
                  backgroundColor: '#f97316', // Orange dot
                  borderRadius: '50%',
                  border: '1px solid #f3f4f6'
                }} />
              )}
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', borderLeft: '1px solid #d1d5db', paddingLeft: isMenuBarCollapsed ? '3px' : '5px' }} className="shrink-0">
              <button 
                onClick={handleUndo} 
                disabled={!canUndo}
                className={`p-1 rounded flex items-center justify-center transition-all duration-200 border shrink-0 ${canUndo ? 'hover:bg-gray-100 hover:border-gray-300 border-transparent cursor-pointer' : 'opacity-30 border-transparent cursor-default'}`}
                title="เลิกทำ (Undo)"
              >
                <Undo2 size={isMenuBarCollapsed ? 14 : 16} color={canUndo ? "#1f2937" : "#9ca3af"} />
              </button>
              <button 
                onClick={handleRedo} 
                disabled={!canRedo}
                className={`p-1 rounded flex items-center justify-center transition-all duration-200 border shrink-0 ${canRedo ? 'hover:bg-gray-100 hover:border-gray-300 border-transparent cursor-pointer' : 'opacity-30 border-transparent cursor-default'}`}
                title="ทำซ้ำ (Redo)"
              >
                <Redo2 size={isMenuBarCollapsed ? 14 : 16} color={canRedo ? "#1f2937" : "#9ca3af"} />
              </button>
              <button 
                onClick={() => setIsHistoryModalOpen(true)} 
                className="menu-btn shrink-0" 
                style={{ marginLeft: isMenuBarCollapsed ? '1px' : '2px' }}
                title="ประวัติการบันทึกข้อความย้อนหลัง (ป้องกันข้อความหายในเครื่อง)"
              >
                <History size={isMenuBarCollapsed ? 14 : 15} style={{ marginRight: isMenuBarCollapsed ? '0' : '4px' }} className="shrink-0" />
                {!isMenuBarCollapsed && <span className="hidden xl:inline">ประวัติ</span>}
              </button>
            </div>
          </div>

          {/* Menu Buttons */}
          <button 
            onClick={handleClear} 
            className="menu-btn shrink-0"
            style={{ 
              color: isConfirmingClear ? '#ef4444' : 'inherit'
            }}
            title={isConfirmingClear ? 'คลิกอีกครั้งเพื่อยืนยันล้างข้อความ!' : 'ล้างข้อความทั้งหมด (มีระบบสำรองข้อมูลฉุกเฉิน)'}
          >
            <Eraser size={isMenuBarCollapsed ? 14 : 15} style={{ marginRight: isMenuBarCollapsed ? '0' : '4px' }} className="shrink-0" />
            {!isMenuBarCollapsed && <span className="hidden sm:inline">{isConfirmingClear ? 'ยืนยัน?' : 'ล้างข้อความ'}</span>}
          </button>
          {/* Copy Split Button (Horizontal) */}
          <div className="relative inline-flex items-center shrink-0" ref={copyMenuRef}>
            <div className={`inline-flex items-center rounded border transition-all ${isCopyMenuOpen ? 'bg-gray-200 border-gray-400' : 'bg-transparent border-transparent hover:bg-gray-100 hover:border-gray-300'}`}>
              {/* Action 1: Click Icon to Copy All Text Immediately */}
              <button 
                onClick={handleCopy} 
                className={`${isMenuBarCollapsed ? 'px-1.5 py-1' : 'px-1.5 md:px-2 py-1'} hover:bg-gray-200 active:bg-gray-300 rounded-l flex items-center justify-center transition-colors text-gray-700 hover:text-blue-600 cursor-pointer shrink-0`}
                title="คัดลอกข้อความทั้งหมด (คลิกไอคอนเพื่อคัดลอกทันที)"
              >
                <Copy size={isMenuBarCollapsed ? 13 : 15} className="shrink-0" />
              </button>

              {/* Subtle Vertical Divider */}
              <div className="w-[1px] h-3.5 bg-gray-300 shrink-0" />

              {/* Action 2: Click Label & Arrow to Open Copy Options */}
              <button 
                onClick={() => setIsCopyMenuOpen(!isCopyMenuOpen)} 
                className={`${isMenuBarCollapsed ? 'px-1 py-1' : 'px-1 md:px-1.5 py-1'} hover:bg-gray-200 active:bg-gray-300 rounded-r flex items-center gap-1 transition-colors cursor-pointer text-xs md:text-sm font-sans whitespace-nowrap shrink-0 ${isCopyMenuOpen ? 'text-blue-600 font-semibold' : 'text-gray-700'}`}
                title="ตัวเลือกการคัดลอก (คลิกเพื่อเลือกคัดลอกข้อความหรือคลิปบอร์ด)"
              >
                {!isMenuBarCollapsed && <span className="hidden sm:inline">คัดลอก</span>}
                <ChevronDown size={isMenuBarCollapsed ? 10 : 12} className={`transition-transform duration-200 shrink-0 ${isCopyMenuOpen ? 'rotate-180 text-blue-600' : 'text-gray-500'}`} />
              </button>
            </div>

            {/* Copy Options Dropdown */}
            {isCopyMenuOpen && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-[100] py-1.5 min-w-[250px]">
                <div className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100 mb-1">
                  ตัวเลือกการคัดลอก (Copy Options)
                </div>
                <button
                  onClick={() => {
                    handleCopy();
                    setIsCopyMenuOpen(false);
                  }}
                  className="w-full text-left px-3.5 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <div className="p-1 rounded bg-blue-50 text-blue-600">
                    <Copy size={15} />
                  </div>
                  <div>
                    <div className="font-medium text-gray-800">คัดลอกข้อความทั้งหมด</div>
                    <div className="text-xs text-gray-500">คัดลอกเนื้อหาทั้งหมดในช่องพิมพ์</div>
                  </div>
                </button>
                <button
                  onClick={() => {
                    handleCopyAllClipboardNames();
                    setIsCopyMenuOpen(false);
                  }}
                  className="w-full text-left px-3.5 py-2 text-sm text-gray-700 hover:bg-emerald-50 hover:text-emerald-600 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <div className="p-1 rounded bg-emerald-50 text-emerald-600">
                    <Users size={15} />
                  </div>
                  <div>
                    <div className="font-medium text-gray-800">คัดลอกรายชื่อในคลิปบอร์ด</div>
                    <div className="text-xs text-gray-500">คัดลอกรายชื่อทั้งหมด (ซ้ายและขวา)</div>
                  </div>
                </button>
              </div>
            )}
          </div>
          <button 
            onClick={() => setIsHeaderModalOpen(true)} 
            className="menu-btn shrink-0" 
            title="พิมพ์ส่วนหัวจากการประชุม"
          >
            <Layout size={isMenuBarCollapsed ? 14 : 15} style={{ marginRight: isMenuBarCollapsed ? '0' : '4px' }} className="shrink-0" />
            {!isMenuBarCollapsed && <span className="hidden lg:inline">พิมพ์ส่วนหัว</span>}
          </button>
          <button 
            onClick={() => setIsSpeechTranscriberOpen(true)} 
            className="menu-btn shrink-0" 
            title="พิมพ์ด้วยเสียง (Speech to Text)"
          >
            <Mic size={isMenuBarCollapsed ? 14 : 15} style={{ marginRight: isMenuBarCollapsed ? '0' : '4px' }} className="shrink-0" />
            {!isMenuBarCollapsed && <span className="hidden sm:inline">พิมพ์ด้วยเสียง</span>}
          </button>

          {/* Font Size Controls */}
          <div style={{ display: 'flex', alignItems: 'center', marginLeft: isMenuBarCollapsed ? '1px' : '3px', borderLeft: '1px solid #e5e7eb', paddingLeft: isMenuBarCollapsed ? '3px' : '5px' }} className="shrink-0">
            {!isMenuBarCollapsed && <Type size={14} color="#6b7280" style={{ marginRight: '3px' }} className="shrink-0 hidden md:inline-block" />}
            <button onClick={handleDecreaseFontSize} className="menu-btn shrink-0" style={{ padding: isMenuBarCollapsed ? '2px 3px' : '3px 5px' }} title="ลดขนาดตัวอักษร">
              <Minus size={isMenuBarCollapsed ? 11 : 13} />
            </button>
            <span style={{ margin: isMenuBarCollapsed ? '0 1px' : '0 3px', fontSize: isMenuBarCollapsed ? '11px' : '13px', color: '#374151', minWidth: '16px', textAlign: 'center' }} className="shrink-0">{fontSize}</span>
            <button onClick={handleIncreaseFontSize} className="menu-btn shrink-0" style={{ padding: isMenuBarCollapsed ? '2px 3px' : '3px 5px' }} title="เพิ่มขนาดตัวอักษร">
              <Plus size={isMenuBarCollapsed ? 11 : 13} />
            </button>
          </div>

          {/* Settings Dropdown */}
          <div className="relative shrink-0" ref={settingsMenuRef} style={{ marginLeft: isMenuBarCollapsed ? '1px' : '3px' }}>
            <button 
              onClick={() => setIsSettingsMenuOpen(!isSettingsMenuOpen)} 
              className={`menu-btn shrink-0 ${isSettingsMenuOpen ? 'bg-blue-50 text-blue-600' : ''}`}
              title="ตั้งค่า (คำย่อ/คีย์ลัด)"
            >
              <Settings size={isMenuBarCollapsed ? 14 : 15} style={{ marginRight: isMenuBarCollapsed ? '0' : '4px' }} className="shrink-0" />
              {!isMenuBarCollapsed && <span className="hidden sm:inline">ตั้งค่า</span>}
              <ChevronDown size={isMenuBarCollapsed ? 10 : 12} style={{ marginLeft: isMenuBarCollapsed ? '1px' : '2px' }} className="shrink-0" />
            </button>
            
            {isSettingsMenuOpen && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-xl z-[100] py-1 min-w-[200px]">
                <button
                  onClick={() => {
                    setIsSnippetManagerOpen(true);
                    setIsSettingsMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
                >
                  <Settings size={14} />
                  ตั้งค่าคำย่อ
                </button>
                <button
                  onClick={() => {
                    setIsShortcutManagerOpen(true);
                    setIsSettingsMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
                >
                  <Keyboard size={14} />
                  ตั้งค่าคีย์ลัด
                </button>
                <button
                  onClick={() => {
                    setIsClipboardSettingsOpen(true);
                    setIsSettingsMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2 border-t border-gray-100"
                >
                  <SlidersHorizontal size={14} />
                  ตั้งค่าคลิปบอร์ด
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Section: Tool Toggles + Clock + Menu Bar Fold/Expand Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMenuBarCollapsed ? '3px' : '6px', flexShrink: 0 }} className="text-xs md:text-sm font-medium text-gray-700">
          {/* Left Clipboard Toggle */}
          <button 
            className="menu-btn shrink-0" 
            onClick={() => setIsLeftClipboardOpen(!isLeftClipboardOpen)}
            title="เปิด/ปิด คลิปบอร์ดซ้าย"
            style={{ 
              padding: isMenuBarCollapsed ? '2px 4px' : '3px 6px', 
              color: isLeftClipboardOpen ? '#2563eb' : '#6b7280',
              backgroundColor: isLeftClipboardOpen ? '#eff6ff' : 'transparent',
              borderRadius: '4px'
            }}
          >
            <PanelLeft size={isMenuBarCollapsed ? 14 : 16} className="shrink-0" />
          </button>

          {/* Right Clipboard Toggle */}
          <button 
            className="menu-btn shrink-0" 
            onClick={() => setIsClipboardOpen(!isClipboardOpen)}
            title="เปิด/ปิด คลิปบอร์ดขวา"
            style={{ 
              padding: isMenuBarCollapsed ? '2px 4px' : '3px 6px', 
              color: isClipboardOpen ? '#2563eb' : '#6b7280',
              backgroundColor: isClipboardOpen ? '#eff6ff' : 'transparent',
              borderRadius: '4px'
            }}
          >
            <PanelRight size={isMenuBarCollapsed ? 14 : 16} className="shrink-0" />
          </button>

          {/* Search Toggle (Google) */}
          <button 
            className="menu-btn shrink-0" 
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            title="เปิด/ปิด ผู้ช่วยค้นหา Google"
            style={{ 
              padding: isMenuBarCollapsed ? '2px 4px' : '3px 6px', 
              color: isSearchOpen ? '#2563eb' : '#6b7280',
              backgroundColor: isSearchOpen ? '#eff6ff' : 'transparent',
              borderRadius: '4px'
            }}
          >
            <Search size={isMenuBarCollapsed ? 14 : 16} className="shrink-0" />
          </button>
          
          {/* Clock */}
          <div style={{ 
            marginLeft: isMenuBarCollapsed ? '1px' : '3px', 
            borderLeft: '1px solid #e5e7eb', 
            paddingLeft: isMenuBarCollapsed ? '4px' : '6px'
          }} className="shrink-0">
            <Clock />
          </div>

          {/* Menu Bar Collapse / Expand Toggle Button (หลังนาฬิกา) */}
          <div style={{ marginLeft: '2px', borderLeft: '1px solid #e5e7eb', paddingLeft: '4px' }} className="shrink-0">
            <button
              onClick={toggleMenuBar}
              className={`flex items-center justify-center cursor-pointer transition-all duration-200 p-1 rounded shrink-0 ${
                isMenuBarCollapsed 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs border border-blue-600'
                  : 'bg-gray-200/90 hover:bg-gray-300 text-gray-700 hover:text-gray-900 border border-gray-300'
              }`}
              title={isMenuBarCollapsed ? "กางแถบเมนูบาร์ (ขยาย)" : "พับแถบเมนูบาร์ (ย่อเหลือเฉพาะไอคอน)"}
            >
              {isMenuBarCollapsed ? (
                <ChevronDown size={isMenuBarCollapsed ? 14 : 15} className="text-white shrink-0" />
              ) : (
                <ChevronUp size={isMenuBarCollapsed ? 14 : 15} className="text-gray-600 shrink-0" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ display: 'flex', flexGrow: 1, overflow: 'hidden', padding: '6px', backgroundColor: '#e5e7eb', minHeight: 0 }}>
        
        {/* Left Clipboard Panel */}
        <div 
          className={`clipboard-panel ${isLeftClipboardOpen ? 'open' : ''}`}
          style={{ 
            display: isLeftClipboardOpen ? 'flex' : 'none',
            marginRight: '6px',
            height: '100%',
            width: `${clipboardWidth}px`,
            minWidth: `${clipboardWidth}px`,
            maxWidth: `${clipboardWidth}px`,
          }}
        >
           <Clipboard 
             onPaste={handlePasteFromClipboard} 
             height={clipboardHeight} 
             storageKey="clipListLeft"
             title="Clipboard (L)"
             itemFontSize={clipboardFontSize}
           />
        </div>

        {/* Text Area Container */}
        <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, margin: 0, padding: '0 4px', position: 'relative', overflow: 'visible' }}>
            <div 
              ref={editorContainerRef}
              style={{ position: 'relative', width: '100%', height: '100%', maxWidth: '900px', margin: '0 auto' }}
            >
              <div style={{ 
                height: '100%', 
                width: '100%', 
                backgroundColor: 'white', 
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                borderRadius: '8px',
                overflow: 'hidden',
                position: 'relative'
              }}>
                <textarea 
                  id="textInput" 
                  ref={textareaRef}
                  value={text}
                  onChange={handleTextChange}
                  onKeyDown={handleKeyDown}
                  onSelect={handleSelect}
                  onFocus={checkUndoRedoStatus}
                  onMouseUp={checkUndoRedoStatus}
                  onContextMenu={handleContextMenu}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragEnter}
                  onScroll={handleScroll}
                  style={editorBaseStyles}
                  className="custom-selection"
                  placeholder="เริ่มพิมพ์ที่นี่ หรือใช้ระบบพิมพ์ด้วยเสียง..."
                  spellCheck={false}
                />
              </div>
              
              {/* Bottom Margin Handle */}
              <div 
                onMouseDown={handleMarginMouseDown}
                onTouchStart={handleMarginTouchStart}
                title="ปรับระยะเว้นขอบด้านล่าง"
                style={{
                  position: 'absolute',
                  bottom: `${bottomMargin}px`,
                  left: '0',
                  width: '100%',
                  height: '2px', // Thin line area
                  display: 'flex',
                  alignItems: 'center',
                  transform: 'translateY(50%)',
                  cursor: 'ns-resize',
                  zIndex: 30, // Above everything
                  pointerEvents: 'none',
                  touchAction: 'none'
                }}
              >
                <div 
                  onMouseDown={handleMarginMouseDown}
                  onTouchStart={handleMarginTouchStart}
                  style={{ 
                    pointerEvents: 'auto',
                    touchAction: 'none',
                    backgroundColor: 'white',
                    borderRadius: '6px 0 0 6px',
                    boxShadow: '-2px 1px 4px rgba(0,0,0,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '36px',
                    height: '36px',
                    border: '1px solid #e5e7eb',
                    borderRight: 'none',
                    marginLeft: '-36px',
                    transition: 'transform 0.1s ease-out',
                    cursor: 'ns-resize',
                    userSelect: 'none',
                    WebkitUserSelect: 'none'
                  }}
                >
                  <ChevronRight size={20} style={{ color: '#3b82f6' }} />
                </div>
                
                {/* Horizontal Line - Stretches across the editor */}
                <div 
                  style={{ 
                    flexGrow: 1, 
                    height: '2px', 
                    background: showMarginLine ? '#3b82f6' : 'rgba(59, 130, 246, 0.1)',
                    opacity: showMarginLine ? 1 : 0.4,
                    transition: 'all 0.2s',
                    boxShadow: showMarginLine ? '0 0 4px rgba(59, 130, 246, 0.5)' : 'none'
                  }} 
                />
              </div>

              {selectionToolbar.show && (
                <SelectionToolbar 
                  selection={selectionToolbar}
                  onClose={() => setSelectionToolbar(prev => ({ ...prev, show: false }))}
                  onAction={handleSelectionToolbarAction}
                />
              )}
            </div>
          <p id="output" style={{ display: 'none' }}></p>
        </div>

        {/* Right Clipboard Panel */}
        <div 
          className={`clipboard-panel ${isClipboardOpen ? 'open' : ''}`}
          style={{ 
            display: isClipboardOpen ? 'flex' : 'none',
            marginLeft: '6px',
            height: '100%',
            width: `${clipboardWidth}px`,
            minWidth: `${clipboardWidth}px`,
            maxWidth: `${clipboardWidth}px`,
          }}
        >
           <Clipboard 
             onPaste={handlePasteFromClipboard} 
             height={clipboardHeight} 
             storageKey="clipList"
             title="Clipboard (R)"
             itemFontSize={clipboardFontSize}
           />
        </div>

        {/* Committee Identifier Panel */}
        {isCommitteeIdentifierOpen && (
          <div style={{ height: '100%', marginLeft: '6px' }}>
            <CommitteeIdentifier 
              isOpen={isCommitteeIdentifierOpen} 
              onClose={() => setIsCommitteeIdentifierOpen(false)} 
              onInsertText={(textToInsert) => {
                insertTextAtCursor(textToInsert);
              }}
            />
          </div>
        )}

      </div>

      <div className="footer" style={{ position: 'static', backgroundColor: '#f3f4f6', padding: '4px 10px', fontSize: '11px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
        <span>เวอร์ชั่น 5.24 27/08/69 20.25</span>
        <a href="https://www.canva.com/design/DAGQm3V8WFA/FJqJY5z6LUMYFrRvCZsr2w/edit?utm_content=DAGQm3V8WFA&utm_campaign=designshare&utm_medium=link2&utm_source=sharebutton" target="_blank" rel="noreferrer" style={{ color: '#4b5563' }}>
            คู่มือ
        </a>
      </div>

      <SnippetManager 
        isOpen={isSnippetManagerOpen} 
        onClose={() => setIsSnippetManagerOpen(false)} 
        onSave={handleSaveSnippets}
        initialSnippets={customSnippets}
        defaultSnippets={defaultSnippets}
      />

      <ShortcutManager 
        isOpen={isShortcutManagerOpen} 
        onClose={() => setIsShortcutManagerOpen(false)} 
        onSave={handleSaveShortcuts}
        initialShortcuts={shortcuts}
        defaultShortcuts={defaultShortcuts}
      />

      <AutoSpeaker 
        isOpen={isAutoSpeakerOpen}
        onClose={() => setIsAutoSpeakerOpen(false)}
        onInsertSpeaker={(speaker) => {
          const cleanSpeaker = speaker.trim().replace(/\s*:+$/, '');
          handlePasteFromClipboard(cleanSpeaker + '   :   ');
        }}
        senatorList={senatorList}
        setSenatorList={setSenatorList}
        speakerList={speakerList}
        setSpeakerList={setSpeakerList}
      />

      <CommitteeSpeaker 
        isOpen={isCommitteeSpeakerOpen}
        onClose={() => setIsCommitteeSpeakerOpen(false)}
        onInsertSpeaker={(speaker) => {
          const cleanSpeaker = speaker.trim().replace(/\s*:+$/, '');
          handlePasteFromClipboard(cleanSpeaker + '   :   ');
        }}
        senatorList={committeeList}
        setSenatorList={setCommitteeList}
        speakerList={committeeSpeakerList}
        setSpeakerList={setCommitteeSpeakerList}
      />

      <PdfConverterModal 
        isOpen={isPdfConverterOpen}
        onClose={() => setIsPdfConverterOpen(false)}
      />

      {/* Custom Context Menu */}
      {contextMenu.show && (
        <div 
          style={{
            position: 'absolute',
            top: contextMenu.y,
            left: contextMenu.x,
            backgroundColor: 'white',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            borderRadius: '8px',
            padding: '8px 0',
            zIndex: 1000,
            minWidth: '200px',
            border: '1px solid #e5e7eb'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button 
            className="context-menu-item"
            onClick={() => { handleContextAddToClip('clipListLeft', 'ซ้าย'); setContextMenu(prev => ({...prev, show: false})); }}
            disabled={!contextMenu.selectedText}
          >
            <PanelLeft size={16} /> เพิ่มลงคลิปบอร์ดซ้าย
          </button>
          <button 
            className="context-menu-item"
            onClick={() => { handleContextAddToClip('clipList', 'ขวา'); setContextMenu(prev => ({...prev, show: false})); }}
            disabled={!contextMenu.selectedText}
          >
            <PanelRight size={16} /> เพิ่มลงคลิปบอร์ดขวา
          </button>
          
          <div style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '4px 0' }} />
          
          <button 
            className="context-menu-item"
            onClick={() => { handleContextInsertLastLine(); setContextMenu(prev => ({...prev, show: false})); }}
            disabled={!contextMenu.selectedText}
          >
            <ArrowDownToLine size={16} /> แทรกในบรรทัดสุดท้าย
          </button>
          <button 
            className="context-menu-item"
            onClick={() => { 
              setSearchQuery(contextMenu.selectedText); 
              setIsSearchOpen(true); 
              setContextMenu(prev => ({...prev, show: false})); 
            }}
            disabled={!contextMenu.selectedText}
          >
            <Search size={16} /> ค้นหาคำนี้...
          </button>

          <div style={{ height: '1px', backgroundColor: '#e5e7eb', margin: '4px 0' }} />

          <button 
            className="context-menu-item"
            onClick={() => { handleContextCut(); setContextMenu(prev => ({...prev, show: false})); }}
            disabled={!contextMenu.selectedText}
          >
            <Scissors size={16} /> ตัด
          </button>
          <button 
            className="context-menu-item"
            onClick={() => { handleContextCopy(); setContextMenu(prev => ({...prev, show: false})); }}
            disabled={!contextMenu.selectedText}
          >
            <Copy size={16} /> คัดลอก
          </button>
          <button 
            className="context-menu-item"
            onClick={() => { handleContextPaste(); setContextMenu(prev => ({...prev, show: false})); }}
          >
            <ClipboardPaste size={16} /> วาง
          </button>
        </div>
      )}

      {/* Meeting Header Modal */}
      <MeetingHeaderModal 
        isOpen={isHeaderModalOpen}
        onClose={() => setIsHeaderModalOpen(false)}
        onInsert={(header) => {
          insertTextAtCursor(header + '\n');
          setIsHeaderModalOpen(false);
        }}
      />

      <MiniSearch 
        isOpen={isSearchOpen} 
        onClose={() => setIsSearchOpen(false)} 
        initialQuery={searchQuery} 
        onInsert={insertTextAtCursor} 
      />

      {isCommitteeReportGeneratorOpen && (
        <CommitteeReportGeneratorModal
          onClose={() => setIsCommitteeReportGeneratorOpen(false)}
          onInsertText={insertTextAtCursor}
        />
      )}

      {isAITrainingOpen && (
        <AITrainingModal onClose={() => setIsAITrainingOpen(false)} />
      )}

      {isThaiProofAIOpen && (
        <ThaiProofAIModal onClose={() => setIsThaiProofAIOpen(false)} />
      )}

      <SpeechTranscriber 
        ref={speechTranscriberRef}
        isOpen={isSpeechTranscriberOpen}
        onClose={() => setIsSpeechTranscriberOpen(false)}
        onInsertText={appendTextToEnd}
        shortcuts={shortcuts}
      />

      <VoiceSpeakerManager 
        isOpen={isVoiceSpeakerManagerOpen}
        onClose={() => setIsVoiceSpeakerManagerOpen(false)}
        onInsertText={appendTextToEnd}
        onRenameSpeaker={handleRenameSpeaker}
      />

      {isSeatingPlannerOpen && (
        <SeatingPlannerModal
          onClose={() => setIsSeatingPlannerOpen(false)}
        />
      )}

      {/* History & Snapshot Manager Modal */}
      <HistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        onRestore={(restoredText) => {
          setText(restoredText);
          setItem('savedText', restoredText);
          saveEmergencyBackup(restoredText, 'history_restore');
          setUserClearedState(false);
          showAlert("นำข้อความกลับมาใช้เรียบร้อยแล้ว!");
        }}
        currentText={text}
      />

      {/* Emergency Data Loss Recovery Modal (Post-Eviction Detection) */}
      <EmergencyRecoveryModal
        isOpen={isEmergencyRecoveryOpen}
        backupData={emergencyBackupData}
        onClose={() => {
          if (emergencyBackupData) {
            markDataLossResolved(emergencyBackupData.timestamp);
          }
          setIsEmergencyRecoveryOpen(false);
        }}
        onRestore={(restoredText) => {
          setText(restoredText);
          setItem('savedText', restoredText);
          saveEmergencyBackup(restoredText, 'emergency_restore');
          setUserClearedState(false);
          if (emergencyBackupData) {
            markDataLossResolved(emergencyBackupData.timestamp);
          }
          setIsEmergencyRecoveryOpen(false);
          showAlert("กู้คืนข้อความลงหน้าจอเรียบร้อยแล้ว!");
        }}
      />

      {/* Clipboard Settings Modal */}
      <ClipboardSettingsModal
        isOpen={isClipboardSettingsOpen}
        onClose={() => setIsClipboardSettingsOpen(false)}
        width={clipboardWidth}
        onWidthChange={handleClipboardWidthChange}
        fontSize={clipboardFontSize}
        onFontSizeChange={handleClipboardFontSizeChange}
        onReset={handleResetClipboardSettings}
      />
    </div>
  );
}

export default App;

