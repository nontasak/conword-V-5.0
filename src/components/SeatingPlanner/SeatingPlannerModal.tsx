/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Copy, 
  Send, 
  Settings,
  X,
  Check,
  BrainCircuit,
  Camera,
  ScanEye,
  AlertCircle,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { parseSeatingText, formatSeatingText, processCommandFallback, SeatingChart } from './SeatingUtils';
import { ImageStrip } from './ImageStrip';

interface SeatingImage {
  id: string;
  url: string;
  base64: string;
  name: string;
}

interface SeatingTableProps {
  chart: SeatingChart | null;
  referenceNames: string[];
  tableFontSize: number;
  headerFontSize: number;
  tableWidth: number;
}

const SeatingTable: React.FC<SeatingTableProps> = ({ 
  chart, 
  referenceNames, 
  tableFontSize, 
  headerFontSize, 
  tableWidth 
}) => {
  if (!chart) return null;

  const isMatched = (name: string) => {
    const clean = (s: string) => s.trim().replace(/\s+/g, ' ');
    const cleanedName = clean(name);
    return referenceNames.some(ref => clean(ref) === cleanedName);
  };

  const StatusDot = ({ name }: { name: string }) => {
    if (!name) return null;
    const matched = isMatched(name);
    const size = Math.max(6, tableFontSize * 0.6);
    return (
      <div 
        style={{ width: `${size}px`, height: `${size}px` }}
        className={`rounded-full shrink-0 ${matched ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]'}`} 
        title={matched ? 'Matched with Reference' : 'OCR / Unmatched'}
      />
    );
  };

  const maxRows = Math.max(chart.leftSide.length, chart.rightSide.length);
  const rows = Array.from({ length: maxRows });

  return (
    <div className="flex justify-center mb-10 overflow-x-auto p-4">
      <div 
        className="bg-white border border-gray-200 rounded-3xl shadow-xl overflow-hidden min-w-[300px]"
        style={{ width: '100%', maxWidth: `${tableWidth}px` }}
      >
        <table className="w-full border-collapse table-fixed">
          <thead>
            <tr>
              <th colSpan={2} className="bg-indigo-50/50 border-b border-gray-200 py-6 text-center">
                <div className="flex flex-col items-center gap-1.5">
                  <span className="font-black text-indigo-400 uppercase tracking-[0.4em]" style={{ fontSize: `${headerFontSize * 0.8}px` }}>Meeting Head</span>
                  <div className="flex items-center gap-3">
                    <StatusDot name={chart.president} />
                    <span className="font-black text-gray-900 tracking-tight" style={{ fontSize: `${tableFontSize * 1.5}px` }}>{chart.president || 'ประธาน'}</span>
                  </div>
                </div>
              </th>
            </tr>
            <tr>
              <th className="bg-gray-50/50 border-b border-r border-gray-200 py-3 text-center">
                <span className="font-black text-gray-400 uppercase tracking-[0.2em]" style={{ fontSize: `${headerFontSize}px` }}>***ขวาประธาน***</span>
              </th>
              <th className="bg-gray-50/50 border-b border-gray-200 py-3 text-center">
                <span className="font-black text-gray-400 uppercase tracking-[0.2em]" style={{ fontSize: `${headerFontSize}px` }}>***ซ้ายประธาน***</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((_, i) => (
              <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/10 transition-colors">
                <td className="border-r border-gray-100 p-2.5">
                  {chart.rightSide[i] && (
                    <div className="flex items-center gap-3 px-4 py-1">
                      <StatusDot name={chart.rightSide[i].name} />
                      <span className="font-bold text-gray-700 whitespace-nowrap overflow-hidden text-ellipsis" style={{ fontSize: `${tableFontSize}px` }}>
                        {chart.rightSide[i].name} :
                      </span>
                    </div>
                  )}
                </td>
                <td className="p-2.5">
                  {chart.leftSide[i] && (
                    <div className="flex items-center gap-3 px-4 py-1">
                      <StatusDot name={chart.leftSide[i].name} />
                      <span className="font-bold text-gray-700 whitespace-nowrap overflow-hidden text-ellipsis" style={{ fontSize: `${tableFontSize}px` }}>
                        {chart.leftSide[i].name} :
                      </span>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {maxRows === 0 && (
               <tr>
                 <td colSpan={2} className="py-24 text-center text-gray-300 font-medium italic text-sm">
                   No seating data available to preview.
                 </td>
               </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

interface SeatingPlannerModalProps {
  onClose: () => void;
}

export function SeatingPlannerModal({ onClose }: SeatingPlannerModalProps) {
  const [inputText, setInputText] = useState<string>(() => {
    return localStorage.getItem('seating-chart-data-final') || '';
  });
  const [command, setCommand] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);

  useEffect(() => {
    localStorage.setItem('seating-chart-data-final', inputText);
  }, [inputText]);

  // Vision State
  const [panoramicImages, setPanoramicImages] = useState<SeatingImage[]>([]);
  const [panoramicPresidentPos, setPanoramicPresidentPos] = useState<'left-head' | 'right-head'>('left-head');
  const [presidentName, setPresidentName] = useState<string>('');
  
  // Reference Names State
  const [referenceNames, setReferenceNames] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('seating-reference-names-v2');
      return saved ? JSON.parse(saved) : [];
    } catch {
      const old = localStorage.getItem('seating-reference-names');
      return old ? old.split('\n').filter(n => n.trim()) : [];
    }
  });
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [tempInput, setTempInput] = useState('');
  const [refPage, setRefPage] = useState(1);
  const [confirmClear, setConfirmClear] = useState(false);
  const ITEMS_PER_PAGE = 5;

  // Status for whether to use AI or Fallback
  const [useAI, setUseAI] = useState<boolean>(true);

  // Table Design Settings
  const [tableFontSize, setTableFontSize] = useState<number>(14);
  const [headerFontSize, setHeaderFontSize] = useState<number>(10);
  const [tableWidth, setTableWidth] = useState<number>(800);

  useEffect(() => {
    localStorage.setItem('seating-reference-names-v2', JSON.stringify(referenceNames));
  }, [referenceNames]);

  const handleProcessReferenceInput = () => {
    if (!tempInput.trim()) return;
    
    const lines = tempInput.split('\n');
    const extracted: string[] = [];
    
    lines.forEach(line => {
      if (line.includes(':')) {
        const namePart = line.split(':')[0].trim();
        if (namePart) {
          const cleaned = namePart.replace(/\s+/g, '  ');
          extracted.push(cleaned);
        }
      }
    });

    if (extracted.length > 0) {
      const newNames = extracted.filter(n => !referenceNames.includes(n));
      setReferenceNames(prev => [...prev, ...newNames]);
      setTempInput('');
      setIsAddModalOpen(false);
      triggerSuccess();
    } else {
      setError("ไม่พบรายชื่อในรูปแบบ 'ชื่อ-นามสกุล :' โปรดตรวจสอบข้อมูล");
    }
  };

  const removeReferenceName = (name: string) => {
    setReferenceNames(prev => prev.filter(n => n !== name));
  };

  const clearAllReferenceNames = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
    setReferenceNames([]);
    setRefPage(1);
    setConfirmClear(false);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64String = reader.result as string;
        resolve(base64String.split(',')[1]); 
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages: SeatingImage[] = [];
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
            const base64 = await fileToBase64(file);
            newImages.push({
                id: Math.random().toString(36).substring(7),
                url: URL.createObjectURL(file),
                base64,
                name: file.name
            });
        } catch (err) {
            console.error("Failed to convert image", err);
        }
    }

    setPanoramicImages(prev => [...prev, ...newImages]);
    e.target.value = '';
  };

  const handleRemoveImage = (id: string) => {
    setPanoramicImages(prev => prev.filter(img => img.id !== id));
  };

  const handleReorderImage = (id: string, direction: 'up' | 'down') => {
    setPanoramicImages(prev => {
      const idx = prev.findIndex(img => img.id === id);
      if (idx === -1) return prev;
      if (direction === 'up' && idx === 0) return prev;
      if (direction === 'down' && idx === prev.length - 1) return prev;

      const newArr = [...prev];
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      [newArr[idx], newArr[targetIdx]] = [newArr[targetIdx], newArr[idx]];
      return newArr;
    });
  };

  const handleScanSeats = async () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      setError("AI Key is required for scanning.");
      return;
    }

    if (panoramicImages.length === 0) {
      setError("Please upload at least one panoramic image to scan.");
      return;
    }

    setIsScanning(true);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey });
      
      const prompt = `
          TASK: Build an EXHAUSTIVE seating chart from PANORAMIC/WIDE-VIEW images of a long meeting table.
          
          IMAGE DESCRIPTION:
          The provided images show a long conference table. There are two rows of seats.
          - "Far Side Row": The row of seats further from the camera (usually at the top of the image).
          - "Near Side Row": The row of seats closer to the camera (usually at the bottom of the image).
          - "Head of Table": The short end where the President sits.

          STRICT REQUIREMENTS:
          1. READ NAMES ACCURATELY: Pay high attention to the text on the nameplates. Many names are in Thai. Transcribe them exactly as they appear.
          2. NO MISSING NAMES: Ensure 100% of the visible nameplates are included.
          3. EXHAUSTIVE SCAN: Scan row-by-row, nameplate-by-nameplate.
          
          LAYOUT MAPPING (VERY IMPORTANT):
          The President is sitting at the ${panoramicPresidentPos.toUpperCase().replace('-', ' ')}.

          - IF PRESIDENT IS AT LEFT HEAD:
            * Top Row (Far Side) = "Left Side of President" (ซ้ายประธาน).
            * Bottom Row (Near Side) = "Right Side of President" (ขวาประธาน).
            * Sequence for BOTH lists: Must start from the person CLOSEST to the President (Left side of image) and move towards the right side of the image.

          - IF PRESIDENT IS AT RIGHT HEAD:
            * Top Row (Far Side) = "Right Side of President" (ขวาประธาน).
            * Bottom Row (Near Side) = "Left Side of President" (ซ้ายประธาน).
            * Sequence for BOTH lists: Must start from the person CLOSEST to the President (Right side of image) and move towards the left side of the image.
          
          INSTRUCTIONS:
          1. Identify all nameplates. Deduplicate names found in overlapping shots.
          ${referenceNames.length > 0 ? `2. Match against this REFERENCE LIST if very similar (>= 90%):
          ---
          ${referenceNames.join('\n')}
          ---` : ''}
          3. President's Name: ${presidentName}. Use this if they are the head.
          4. Return JSON with TWO SPACES between first name and surname.

          OUTPUT FORMAT:
          Return ONLY a JSON object:
          {
            "president": "Name",
            "leftSide": [{"name": "Name", "status": "reference" | "ocr"}],
            "rightSide": [{"name": "Name", "status": "reference" | "ocr"}]
          }
        `;
      const imageParts = [
          ...panoramicImages.map(img => ({
            inlineData: { mimeType: "image/jpeg", data: img.base64 }
          }))
        ];

      const response = await ai.models.generateContent({
        model: "gemini-1.5-pro",
        contents: [
          {
            parts: [
              { text: prompt },
              ...imageParts
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          temperature: 0.1
        }
      });

      const textResult = response.text;
      const cleanedJson = textResult.replace(/```json|```/g, "").trim();
      
      try {
        const parsedChart = JSON.parse(cleanedJson) as SeatingChart;
        const formatted = formatSeatingText(parsedChart);
        setInputText(formatted);
        triggerSuccess();
      } catch (e) {
        console.error("Failed to parse vision JSON", textResult);
        throw new Error("AI failed to read data in correct format.");
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to scan images.");
    } finally {
      setIsScanning(false);
    }
  };

  const triggerSuccess = () => {
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleProcess = async () => {
    if (!command.trim()) return;
    setIsProcessing(true);
    setError(null);

    const currentChart = parseSeatingText(inputText);
    if (!currentChart) {
      setError("Invalid seating chart format.");
      setIsProcessing(false);
      return;
    }

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (useAI && apiKey) {
        const ai = new GoogleGenAI({ apiKey });
        
        const systemInstruction = `
          You are a professional seating chart manager.
          You accurately apply natural language commands to a structured seating chart.
          COMMANDS CAN BE IN THAI OR ENGLISH.
          ${referenceNames.length > 0 ? `STRICT REFERENCE LIST MATCHING: Only use names from the following list if they are an extremely close match (>= 90%) to what is requested or scanned. DO NOT guess or swap names for different people. \n${referenceNames.join('\n')}` : ''}
          INPUT FORMAT: JSON object where leftSide and rightSide are arrays of objects: { name: string, status: "ocr" | "reference" | "manual" }. 
          TASK: Return ONLY updated JSON. Keep the existing "status" for names unless the user replaces them. New names should have status "manual".
        `;

        const prompt = `
          Current Chart Data: ${JSON.stringify(currentChart)}
          User Command: "${command}"
          Updated JSON:
        `;

        const response = await ai.models.generateContent({
          model: "gemini-1.5-pro",
          contents: [{ parts: [{ text: prompt }] }],
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            temperature: 0.1
          }
        });

        const textResult = response.text;
        const cleanedJson = textResult.replace(/```json|```/g, "").trim();
        
        if (cleanedJson) {
           try {
              const updatedChart = JSON.parse(cleanedJson) as SeatingChart;
              setInputText(formatSeatingText(updatedChart));
              triggerSuccess();
           } catch (e) {
              throw new Error("AI returned invalid data format. Falling back to basic logic.");
           }
        }
      } else {
        const updatedChart = processCommandFallback(currentChart, command);
        setInputText(formatSeatingText(updatedChart));
        triggerSuccess();
      }
      setCommand('');
    } catch (err: any) {
      setError(err.message || "Failed to process command.");
      const currentChart = parseSeatingText(inputText);
      if (currentChart) {
        const updatedChart = processCommandFallback(currentChart, command);
        setInputText(formatSeatingText(updatedChart));
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = () => {
    if (!inputText) return;
    navigator.clipboard.writeText(inputText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-gray-50 text-gray-800 font-sans flex flex-col w-full max-w-7xl h-[90vh] rounded-[2rem] overflow-hidden shadow-2xl border border-white/20 select-none"
      >
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <BrainCircuit className="text-white w-5 h-5" />
            </div>
            <h1 className="text-lg font-bold text-gray-900 tracking-tight">AI Seating Planner</h1>
          </div>
          
          <div className="flex items-center gap-4">
             {useAI ? (
               <div className="flex items-center gap-1.5 text-[12px] font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                 <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                 AI Engine Active
               </div>
             ) : (
               <div className="flex items-center gap-1.5 text-[12px] font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100">
                 <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                 Standard Mode
               </div>
             )}
             <button 
               onClick={() => setShowConfig(!showConfig)}
               className="px-4 py-1.5 bg-white border border-gray-300 rounded-md text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-all shadow-sm"
             >
               Settings
             </button>
             <button 
               onClick={onClose}
               className="p-2 hover:bg-gray-100 rounded-full transition-colors"
             >
               <X className="w-6 h-6 text-gray-400" />
             </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
          <div className="max-w-6xl mx-auto flex flex-col gap-8">
            {/* Vision & Imaging Zone */}
            <section className="bg-white border border-gray-200 rounded-[2.5rem] p-8 shadow-sm relative shrink-0">
              <div className="flex flex-col lg:flex-row gap-8 items-start">
                <div className="flex-1 w-full space-y-6">
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1 space-y-4">
                      <div className="flex justify-between items-center bg-indigo-50/50 p-2 rounded-2xl border border-indigo-100/50">
                        <div className="flex items-center gap-2 pl-2">
                          <Camera className="w-3.5 h-3.5 text-indigo-600" />
                          <span className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">Panoramic Table View</span>
                        </div>
                        <div className="flex bg-white rounded-xl p-1 border border-indigo-100 shadow-sm overflow-hidden">
                          <button 
                            onClick={() => setPanoramicPresidentPos('left-head')}
                            className={`px-3 py-1.5 text-[9px] font-bold rounded-lg transition-all flex items-center gap-1.5 ${panoramicPresidentPos === 'left-head' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-indigo-600'}`}
                          >
                            PREZ AT LEFT HEAD
                          </button>
                          <button 
                            onClick={() => setPanoramicPresidentPos('right-head')}
                            className={`px-3 py-1.5 text-[9px] font-bold rounded-lg transition-all flex items-center gap-1.5 ${panoramicPresidentPos === 'right-head' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-indigo-600'}`}
                          >
                            PREZ AT RIGHT HEAD
                          </button>
                        </div>
                      </div>
                      <ImageStrip 
                        label="Upload Panoramic/Total Table Photos" 
                        images={panoramicImages} 
                        onUpload={(e) => handleUpload(e)}
                        onRemove={(id) => handleRemoveImage(id)}
                        onReorder={(id, dir) => handleReorderImage(id, dir)}
                        presidentAt={panoramicPresidentPos === 'left-head' ? 'left' : 'right'}
                      />
                    </div>

                    <div className="flex flex-col items-center gap-4 px-4 min-w-[240px] self-stretch justify-center border-x border-gray-100 py-4 bg-gray-50/30 rounded-3xl shrink-0">
                       <div className="w-full space-y-2">
                         <label className="text-[10px] font-black text-gray-900 uppercase tracking-[0.2em] block text-center">President Name</label>
                         <input 
                           type="text"
                           value={presidentName}
                           onChange={(e) => setPresidentName(e.target.value)}
                           placeholder="President..."
                           className="w-full bg-white border-2 border-gray-100 rounded-2xl px-3 py-3 text-[13px] font-bold outline-none focus:border-indigo-600 transition-all text-center placeholder:opacity-30 shadow-sm"
                         />
                       </div>
                       
                       <button
                         onClick={handleScanSeats}
                         disabled={isScanning || panoramicImages.length === 0}
                         className="w-full h-16 bg-gray-900 text-white rounded-2xl font-black text-xs flex flex-col items-center justify-center gap-1 hover:bg-black disabled:opacity-20 transition-all active:scale-95 shadow-xl group border-b-4 border-black"
                       >
                         {isScanning ? (
                           <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                         ) : (
                           <ScanEye className="w-6 h-6 group-hover:scale-110 transition-transform" />
                         )}
                         <span className="tracking-[0.2em] uppercase">{isScanning ? 'SCANNING...' : 'GENERATE FROM TOTAL VIEW'}</span>
                       </button>
                    </div>
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {isScanning && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-white/70 backdrop-blur-[3px] flex items-center justify-center z-30 rounded-[2.5rem]"
                  >
                    <div className="flex flex-col items-center gap-4">
                      <div className="relative">
                        <div className="w-20 h-20 border-4 border-indigo-600/10 border-t-indigo-600 rounded-full animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <BrainCircuit className="w-8 h-8 text-indigo-600 animate-pulse" />
                        </div>
                      </div>
                      <div className="text-center space-y-1">
                        <p className="text-[11px] font-bold tracking-[0.5em] uppercase text-indigo-900">Vision Mode</p>
                        <p className="text-[9px] font-medium text-gray-400">Gemini is reading nameplates from table view...</p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>

            <div className="flex flex-col gap-6">
              <div className="flex justify-between items-center px-4">
                <div className="flex items-center gap-4">
                  <div className="w-2 h-8 bg-indigo-600 rounded-full" />
                  <div className="flex flex-col">
                    <h2 className="text-[14px] font-black text-gray-900 uppercase tracking-[0.3em]">Unified Seating Chart</h2>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Master Collaboration Surface</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {showSuccess && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.9, x: 20 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.9, x: 20 }}
                      className="bg-emerald-500 text-white text-[10px] px-3 py-1.5 rounded-full flex items-center gap-2 font-bold uppercase tracking-wider shadow-lg"
                    >
                      <Check className="w-3 h-3" />
                      Synced
                    </motion.div>
                  )}
                  
                  <div className="flex bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
                    <button
                      onClick={() => setInputText('')}
                      className="flex items-center gap-2 px-3 py-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all text-[11px] font-bold uppercase tracking-wider"
                      title="Clear All"
                    >
                      <X className="w-3.5 h-3.5" />
                      Clear
                    </button>
                    <div className="w-px h-4 bg-gray-200 self-center mx-1" />
                    <button
                      onClick={handleCopy}
                      className={`flex items-center gap-2 px-4 py-1.5 rounded-lg transition-all text-[11px] font-bold uppercase tracking-wider shadow-sm ${copied ? 'bg-emerald-600 text-white' : 'bg-gray-900 text-white hover:bg-black'}`}
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Copied' : 'Copy Plan'}
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="space-y-8">
                {/* Table Appearance Controls */}
                <div className="bg-white border border-gray-100 rounded-[2rem] p-6 shadow-sm flex flex-wrap items-center gap-12 justify-center shrink-0">
                  <div className="flex flex-col gap-2 min-w-[200px]">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Table Width ({tableWidth}px)</label>
                    <input 
                      type="range" 
                      min="400" 
                      max="1400" 
                      step="50"
                      value={tableWidth} 
                      onChange={(e) => setTableWidth(Number(e.target.value))}
                      className="accent-indigo-600 h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer w-full"
                    />
                  </div>
                  <div className="flex flex-col gap-2 min-w-[200px]">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Name Font ({tableFontSize}px)</label>
                    <input 
                      type="range" 
                      min="10" 
                      max="32" 
                      value={tableFontSize} 
                      onChange={(e) => setTableFontSize(Number(e.target.value))}
                      className="accent-indigo-600 h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer w-full"
                    />
                  </div>
                  <div className="flex flex-col gap-2 min-w-[200px]">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Header Font ({headerFontSize}px)</label>
                    <input 
                      type="range" 
                      min="8" 
                      max="24" 
                      value={headerFontSize} 
                      onChange={(e) => setHeaderFontSize(Number(e.target.value))}
                      className="accent-indigo-600 h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer w-full"
                    />
                  </div>
                </div>

                {/* Visual Table Layout */}
                <div className="min-h-[200px] flex items-start justify-center">
                  <SeatingTable 
                    chart={parseSeatingText(inputText)} 
                    referenceNames={referenceNames} 
                    tableFontSize={tableFontSize}
                    headerFontSize={headerFontSize}
                    tableWidth={tableWidth}
                  />
                </div>

                <div className="min-h-[400px] relative bg-white border border-gray-200 rounded-[2.5rem] shadow-sm overflow-hidden flex shrink-0">
                  <div className="w-14 bg-gray-50/50 border-r border-gray-100 flex flex-col py-10 select-none">
                    {inputText.split('\n').map((_, i) => (
                      <div key={i} className="h-[32px] flex items-center justify-center text-[11px] font-mono font-bold text-gray-300">
                        {String(i + 1).padStart(2, '0')}
                      </div>
                    ))}
                  </div>
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Paste seating list here or scan photos..."
                    className="flex-1 w-full h-[400px] p-10 bg-transparent outline-none focus:ring-0 transition-all font-mono text-[16px] leading-[32px] resize-none text-gray-700 tracking-tight"
                    spellCheck={false}
                  />
                  
                  <AnimatePresence>
                    {isProcessing && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-white/40 backdrop-blur-[4px] flex items-center justify-center z-20"
                      >
                        <div className="flex flex-col items-center gap-6">
                          <div className="w-16 h-16 border-[5px] border-indigo-600/10 border-t-indigo-600 rounded-full animate-spin" />
                          <div className="flex flex-col items-center gap-1">
                            <p className="text-[12px] font-black tracking-[0.4em] uppercase text-indigo-600">Syncing</p>
                            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Updating flow...</p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="py-8 text-center">
                  <p className="text-[9px] uppercase tracking-[0.3em] text-gray-400 font-bold">Strategic Layout • V2.5.0</p>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Footer: Command Input */}
        <footer className="bg-white border-t border-gray-200 p-6 flex flex-col gap-4 flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <input
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleProcess()}
                placeholder="Command AI: e.g. 'Move คุณกบ to position 2 on the right'"
                className="w-full h-12 bg-gray-50 border border-gray-200 rounded-xl pl-12 pr-4 text-[15px] outline-none focus:border-indigo-500 focus:bg-white transition-all font-medium"
              />
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
                <BrainCircuit className="w-5 h-5 opacity-50" />
              </div>
            </div>
            
            <button
              onClick={handleProcess}
              disabled={isProcessing || !command.trim()}
              className="h-12 px-8 bg-indigo-600 text-white rounded-xl font-bold text-[15px] flex items-center gap-2 hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-95 group"
            >
              Execute
              <Send className="w-4 h-4 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
            </button>
          </div>
          
          {error && (
            <div className="px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-lg text-xs font-medium flex items-center gap-2">
              <X className="w-3.5 h-3.5 flex-shrink-0" />
              {error}
            </div>
          )}
        </footer>

        {/* Config Modal */}
        <AnimatePresence>
          {showConfig && (
            <div className="fixed inset-0 z-[150] flex items-center justify-end p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowConfig(false)}
                className="absolute inset-0 bg-black/20"
              />
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                className="h-full w-full max-w-sm bg-white shadow-2xl p-8 flex flex-col gap-6 relative rounded-2xl"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold">Preferences</h3>
                  <button onClick={() => setShowConfig(false)} className="p-2 hover:bg-gray-100 rounded-full">
                    <X className="w-6 h-6 text-gray-400" />
                  </button>
                </div>

                <div className="space-y-6 overflow-y-auto">
                  <section>
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4 px-1">Correct Name List</h4>
                    <div className="flex flex-col gap-4">
                      <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="w-full py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all"
                      >
                        ADD NAMES
                      </button>
                      <div className="bg-gray-100 rounded-xl max-h-60 overflow-y-auto divide-y divide-gray-200">
                        {referenceNames.length > 0 ? referenceNames.map(name => (
                          <div key={name} className="flex items-center justify-between p-3">
                            <span className="text-xs truncate">{name}</span>
                            <button onClick={() => removeReferenceName(name)}><Trash2 className="w-4 h-4 text-red-400" /></button>
                          </div>
                        )) : <div className="p-4 text-center text-xs text-gray-400">No names added</div>}
                      </div>
                    </div>
                  </section>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Add Names Internal Modal */}
        <AnimatePresence>
          {isAddModalOpen && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white w-full max-w-lg rounded-3xl p-8 shadow-2xl"
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-black">Import Names</h3>
                  <button onClick={() => setIsAddModalOpen(false)}><X/></button>
                </div>
                <textarea
                  value={tempInput}
                  onChange={(e) => setTempInput(e.target.value)}
                  placeholder="Paste multi-column data here (Name : format)..."
                  className="w-full h-60 bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 text-sm font-mono resize-none mb-4"
                />
                <div className="flex gap-4">
                  <button onClick={() => setIsAddModalOpen(false)} className="flex-1 py-3 bg-gray-100 rounded-xl text-xs font-bold">Cancel</button>
                  <button onClick={handleProcessReferenceInput} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-xs font-bold">Extract & Save</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
