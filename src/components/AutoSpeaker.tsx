import React, { useState, useEffect, useRef } from 'react';
import { createWorker, Worker } from 'tesseract.js';
import { getBestMatches, calculateSimilarity } from '../utils/textProcessing';
import { X, Play, Square, Settings, Maximize, Minimize, Crosshair, Trash2, Plus, Search, RotateCcw, Edit2, Check, UserPlus, AlertCircle, ArrowDownToLine, Eraser, Camera, ScanFace, Loader2 } from 'lucide-react';
import { loadFaceModels, extractCenterFace, saveFaceToDB, getFaceDB, deleteFaceFromDB, recognizeFace, exportFaceDB, importFaceDB, clearFaceDB, trackCenterFace, extractColorGrid } from '../services/faceService';

interface AutoSpeakerProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertSpeaker: (speaker: string) => void;
  senatorList: string[];
  setSenatorList: (list: string[]) => void;
  speakerList: string[];
  setSpeakerList: (list: string[]) => void;
}

export const AutoSpeaker: React.FC<AutoSpeakerProps> = ({
  isOpen,
  onClose,
  onInsertSpeaker,
  senatorList,
  setSenatorList,
  speakerList,
  setSpeakerList,
}) => {
  const handleConfirm = async (descriptor: Float32Array) => {
    if (!faceBox || !faceBox.label) return;
    
    // label は "Name (confidence%)" の形式になっているので、名前を抽出
    const name = faceBox.label.split(' (')[0];
    if (name === 'ไม่รู้จัก') return;

    await saveFaceToDB(name, descriptor, 'faceDB', {});
    setFaceBox(prev => prev ? { ...prev, label: 'บันทึกสำเร็จ!' } : null);
    setTimeout(() => setFaceBox(null), 1000);
  };
  
  const [isCapturing, setIsCapturing] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [predictions, setPredictions] = useState<string[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isManualCropOpen, setIsManualCropOpen] = useState(false);
  const [rawText, setRawText] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  
  // Face API State
  const [isFaceApiLoaded, setIsFaceApiLoaded] = useState(false);
  const [isRegisteringFace, setIsRegisteringFace] = useState(false);
  const isRegisteringFaceRef = useRef(false);
  const [indexedFaces, setIndexedFaces] = useState<string[]>([]);

  useEffect(() => {
    isRegisteringFaceRef.current = isRegisteringFace;
  }, [isRegisteringFace]);
  const [faceBox, setFaceBox] = useState<{
    x: number, 
    y: number, 
    width: number, 
    height: number, 
    label?: string, 
    color: string,
    descriptor?: Float32Array, // Add descriptor
    debug?: {
      distance: number,
      pose: { yaw: number, pitch: number },
      blur: number
    }
  } | null>(null);
  const [faceMatch, setFaceMatch] = useState<{name: string, confidence: number} | null>(null);
  const [faceThreshold, setFaceThreshold] = useState(() => {
    const saved = localStorage.getItem('autoSpeakerFaceThreshold');
    return saved ? parseFloat(saved) : 0.40;
  });
  const [useAutoContrast, setUseAutoContrast] = useState(() => {
    const saved = localStorage.getItem('autoSpeakerUseAutoContrast');
    return saved ? saved === 'true' : false;
  });
  const [isDebugMode, setIsDebugMode] = useState(() => {
    const saved = localStorage.getItem('autoSpeakerIsDebugMode');
    return saved ? saved === 'true' : false;
  });
  const [faceBoxWidth, setFaceBoxWidth] = useState(() => {
    const saved = localStorage.getItem('autoSpeakerFaceBoxWidth');
    return saved ? parseFloat(saved) : 22; // Default 22%
  });
  const [faceBoxHeight, setFaceBoxHeight] = useState(() => {
    const saved = localStorage.getItem('autoSpeakerFaceBoxHeight');
    return saved ? parseFloat(saved) : 30; // Default 30%
  });
  const [enableOCR, setEnableOCR] = useState(() => {
    const saved = localStorage.getItem('autoSpeakerEnableOCR');
    return saved ? saved === 'true' : true; // Default true
  });
  const [enableReId, setEnableReId] = useState(() => {
    const saved = localStorage.getItem('autoSpeakerEnableReId');
    return saved ? saved === 'true' : false;
  });
  const [enableSuperRes, setEnableSuperRes] = useState(() => {
    const saved = localStorage.getItem('autoSpeakerEnableSuperRes');
    return saved ? saved === 'true' : false;
  });
  const [enableSpatialBias, setEnableSpatialBias] = useState(() => {
    const saved = localStorage.getItem('autoSpeakerEnableSpatialBias');
    return saved ? saved === 'true' : false;
  });
  const faceIntervalRef = useRef<number | null>(null);
  const faceTrackingIntervalRef = useRef<number | null>(null);
  const faceBoxTimeoutRef = useRef<number | null>(null);
  const faceMatchRef = useRef<{name: string, confidence: number} | null>(null);
  
  // Speaker list management state
  const [newSpeakerInput, setNewSpeakerInput] = useState('');
  const [speakerSearchQuery, setSpeakerSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'senators' | 'speakers' | 'faces' | 'settings'>('senators');
  const [editingSpeaker, setEditingSpeaker] = useState<{ index: number, value: string } | null>(null);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkInput, setBulkInput] = useState('');
  const [editingPrediction, setEditingPrediction] = useState<number | null>(null);
  const [editingPredictionValue, setEditingPredictionValue] = useState('');
  
  // Add to list modal state
  const [addModal, setAddModal] = useState<{ isOpen: boolean, name: string, category: 'senators' | 'speakers' }>({
    isOpen: false,
    name: '',
    category: 'senators'
  });
  const [toast, setToast] = useState<{ show: boolean, msg: string, type: 'success' | 'error' }>({
    show: false,
    msg: '',
    type: 'success'
  });
  
  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{ show: boolean, message: string, onConfirm: () => void }>({
    show: false,
    message: '',
    onConfirm: () => {}
  });

  // Crop box state (percentages)
  const [cropBox, setCropBox] = useState(() => {
    const saved = localStorage.getItem('autoSpeakerCropBox');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return { x: 34.08, y: 66.90, width: 28.28, height: 5 };
  });
  const [dragState, setDragState] = useState<{ type: 'move' | 'resize', startX: number, startY: number, startCropX: number, startCropY: number, startCropW: number, startCropH: number } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null); // Invisible video for continuous OCR
  const previewVideoRef = useRef<HTMLVideoElement>(null); // Visible video for preview
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const intervalRef = useRef<number | null>(null);
  const metadataIntervalRef = useRef<number | null>(null);
  const lastImageDataRef = useRef<ImageData | null>(null);
  const currentMetadataRef = useRef<any>(null);

  // Refs for stale closure in setInterval
  const isCapturingRef = useRef(isCapturing);
  const faceBoxRef = useRef(faceBox);
  const cropBoxRef = useRef(cropBox);
  const combinedListRef = useRef([...senatorList, ...speakerList]);
  const isProcessingFaceRef = useRef(false);
  const isTrackingFaceRef = useRef(false);
  const isProcessingOCRRef = useRef(false);
  const faceThresholdRef = useRef(faceThreshold);
  const useAutoContrastRef = useRef(useAutoContrast);
  const faceResultBufferRef = useRef<string[]>([]);
  const predictionHistoryRef = useRef<string[]>([]);
  
  // Advanced Recognition Refs
  const clothingProfilesRef = useRef<Record<string, { clothingGrid?: any, headGrid?: any, lastSeen?: number, confidence?: number }>>({});
  const spatialBiasRef = useRef<Record<string, { name: string, count: number, x: number, y: number }>>({});
  const enableReIdRef = useRef(enableReId);
  const enableSpatialBiasRef = useRef(enableSpatialBias);

  useEffect(() => {
    useAutoContrastRef.current = useAutoContrast;
    localStorage.setItem('autoSpeakerUseAutoContrast', useAutoContrast.toString());
  }, [useAutoContrast]);

  useEffect(() => { enableReIdRef.current = enableReId; }, [enableReId]);
  useEffect(() => { enableSpatialBiasRef.current = enableSpatialBias; }, [enableSpatialBias]);

  useEffect(() => { isCapturingRef.current = isCapturing; }, [isCapturing]);
  useEffect(() => { faceBoxRef.current = faceBox; }, [faceBox]);
  useEffect(() => { 
    cropBoxRef.current = cropBox; 
    localStorage.setItem('autoSpeakerCropBox', JSON.stringify(cropBox));
  }, [cropBox]);
  useEffect(() => { 
    combinedListRef.current = [...senatorList, ...speakerList]; 
  }, [senatorList, speakerList]);
  useEffect(() => { 
    faceThresholdRef.current = faceThreshold;
    localStorage.setItem('autoSpeakerFaceThreshold', faceThreshold.toString());
  }, [faceThreshold]);

  useEffect(() => {
    localStorage.setItem('autoSpeakerEnableReId', enableReId.toString());
  }, [enableReId]);

  useEffect(() => {
    localStorage.setItem('autoSpeakerEnableSuperRes', enableSuperRes.toString());
  }, [enableSuperRes]);

  useEffect(() => {
    localStorage.setItem('autoSpeakerEnableSpatialBias', enableSpatialBias.toString());
  }, [enableSpatialBias]);

  const refreshIndexedFaces = () => {
    const db = getFaceDB();
    setIndexedFaces(Object.keys(db));
  };

  const exportAutoSpeakerData = () => {
    try {
      const faceDBData = localStorage.getItem('faceDB');
      const faceDB = faceDBData ? JSON.parse(faceDBData) : {};
      
      const exportData = {
        senatorList,
        speakerList,
        faceDB
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `autospeaker_data_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setToast({ show: true, msg: 'ส่งออกข้อมูลสำเร็จ', type: 'success' });
      setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    } catch (error) {
      console.error('Error exporting autospeaker data:', error);
      setToast({ show: true, msg: 'ส่งออกข้อมูลไม่สำเร็จ', type: 'error' });
      setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    }
  };

  const importAutoSpeakerData = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        
        if (data && typeof data === 'object') {
          let hasImportedSomething = false;
          
          if (Array.isArray(data.senatorList)) {
            setSenatorList(data.senatorList);
            hasImportedSomething = true;
          }
          
          if (Array.isArray(data.speakerList)) {
            setSpeakerList(data.speakerList);
            hasImportedSomething = true;
          }
          
          if (data.faceDB && typeof data.faceDB === 'object') {
            localStorage.setItem('faceDB', JSON.stringify(data.faceDB));
            refreshIndexedFaces();
            hasImportedSomething = true;
          } else if (!data.senatorList && !data.speakerList && Object.keys(data).length > 0) {
            // Fallback for old face DB format
            localStorage.setItem('faceDB', JSON.stringify(data));
            refreshIndexedFaces();
            hasImportedSomething = true;
          }
          
          if (hasImportedSomething) {
            setToast({ show: true, msg: 'นำเข้าข้อมูลสำเร็จ', type: 'success' });
          } else {
            setToast({ show: true, msg: 'รูปแบบไฟล์ไม่ถูกต้อง', type: 'error' });
          }
        } else {
          setToast({ show: true, msg: 'รูปแบบไฟล์ไม่ถูกต้อง', type: 'error' });
        }
      } catch (error) {
        console.error('Error importing autospeaker data:', error);
        setToast({ show: true, msg: 'นำเข้าข้อมูลไม่สำเร็จ', type: 'error' });
      }
      setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    refreshIndexedFaces();
  }, []);

  const formatSpeakerName = (name: string) => {
    // Replace any whitespace group with exactly two spaces
    return name.trim().replace(/\s+/g, '  ');
  };

  useEffect(() => {
    // Initialize Tesseract worker
    const initWorker = async () => {
      const worker = await createWorker('tha+eng');
      await worker.setParameters({
        tessedit_pageseg_mode: '7' as any, // Treat the image as a single text line to improve name recognition
      });
      workerRef.current = worker;
    };
    initWorker();

    // Initialize Face API models
    const initFaceApi = async () => {
      try {
        await loadFaceModels();
        setIsFaceApiLoaded(true);
      } catch (err) {
        console.error("Failed to load Face API models", err);
      }
    };
    initFaceApi();

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
      stopCapture();
    };
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState || !previewVideoRef.current) return;
      
      const rect = previewVideoRef.current.getBoundingClientRect();
      const dx = ((e.clientX - dragState.startX) / rect.width) * 100;
      const dy = ((e.clientY - dragState.startY) / rect.height) * 100;

      if (dragState.type === 'move') {
        setCropBox({
          ...cropBox,
          x: Math.max(0, Math.min(100 - cropBox.width, dragState.startCropX + dx)),
          y: Math.max(0, Math.min(100 - cropBox.height, dragState.startCropY + dy))
        });
      } else if (dragState.type === 'resize') {
        setCropBox({
          ...cropBox,
          width: Math.max(5, Math.min(100 - cropBox.x, dragState.startCropW + dx)),
          height: Math.max(5, Math.min(100 - cropBox.y, dragState.startCropH + dy))
        });
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
    };

    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, cropBox]);

  const handleMouseDownMove = (e: React.MouseEvent) => {
    e.preventDefault();
    setDragState({
      type: 'move',
      startX: e.clientX,
      startY: e.clientY,
      startCropX: cropBox.x,
      startCropY: cropBox.y,
      startCropW: cropBox.width,
      startCropH: cropBox.height
    });
  };

  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragState({
      type: 'resize',
      startX: e.clientX,
      startY: e.clientY,
      startCropX: cropBox.x,
      startCropY: cropBox.y,
      startCropW: cropBox.width,
      startCropH: cropBox.height
    });
  };

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
    if (previewVideoRef.current && stream) {
      previewVideoRef.current.srcObject = stream;
    }
  }, [stream, isMinimized]); // Re-bind when isMinimized changes because preview video unmounts/remounts

  useEffect(() => {
    localStorage.setItem('autoSpeakerFaceThreshold', faceThreshold.toString());
  }, [faceThreshold]);

  useEffect(() => {
    localStorage.setItem('autoSpeakerUseAutoContrast', useAutoContrast.toString());
  }, [useAutoContrast]);

  useEffect(() => {
    localStorage.setItem('autoSpeakerIsDebugMode', isDebugMode.toString());
  }, [isDebugMode]);

  useEffect(() => {
    localStorage.setItem('autoSpeakerFaceBoxWidth', faceBoxWidth.toString());
  }, [faceBoxWidth]);

  useEffect(() => {
    localStorage.setItem('autoSpeakerFaceBoxHeight', faceBoxHeight.toString());
  }, [faceBoxHeight]);

  useEffect(() => {
    localStorage.setItem('autoSpeakerEnableOCR', enableOCR.toString());
  }, [enableOCR]);

  const startCapture = async () => {
    setErrorMsg(null);
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser' },
        audio: false,
      });
      setStream(displayStream);
      setIsCapturing(true);
      
      // Handle stream stop from browser UI
      displayStream.getVideoTracks()[0].onended = () => {
        stopCapture();
      };

      // Start OCR loop
      intervalRef.current = window.setInterval(performOCR, 3000);
      // Start Face Recognition loop (heavy)
      faceIntervalRef.current = window.setInterval(performFaceRecognition, 1000);
      // Start Face Tracking loop (light)
      faceTrackingIntervalRef.current = window.setInterval(performFaceTracking, 150);
      // Start Metadata Extraction loop (very heavy, run every 15s)
      metadataIntervalRef.current = window.setInterval(performMetadataExtraction, 15000);
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission denied')) {
        setErrorMsg('ไม่ได้รับอนุญาตให้เข้าถึงหน้าจอ กรุณากดยอมรับการแชร์หน้าจอ หรือตรวจสอบการตั้งค่าของเบราว์เซอร์');
      } else {
        console.error("Error starting screen capture:", err);
        setErrorMsg('เกิดข้อผิดพลาดในการเปิดแชร์หน้าจอ: ' + (err.message || 'ไม่ทราบสาเหตุ'));
      }
    }
  };

  const stopCapture = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    if (faceIntervalRef.current) {
      clearInterval(faceIntervalRef.current);
    }
    if (faceTrackingIntervalRef.current) {
      clearInterval(faceTrackingIntervalRef.current);
    }
    if (metadataIntervalRef.current) {
      clearInterval(metadataIntervalRef.current);
    }
    if (faceBoxTimeoutRef.current) {
      clearTimeout(faceBoxTimeoutRef.current);
    }
    setStream(null);
    setIsCapturing(false);
    setPredictions([]);
    setRawText('');
    setFaceBox(null);
    setFaceMatch(null);
    faceMatchRef.current = null;
    lastImageDataRef.current = null;
  };

  const handleRegisterFace = async (targetName: string) => {
    if (!previewVideoRef.current || !isFaceApiLoaded) return false;
    
    setIsRegisteringFace(true);
    // Allow UI to update before heavy computation
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      const collectedData: { descriptor: Float32Array, extraFeatures: any }[] = [];
      const maxFrames = 3; // Fast burst
      const maxAttempts = 10;
      let attempts = 0;
      
      while (collectedData.length < maxFrames && attempts < maxAttempts) {
        attempts++;
        // Use skipQualityCheck=true (3rd param) and isEnrollment=true (5th param) for maximum leniency
        const detection = await extractCenterFace(previewVideoRef.current, true, true, null, true);
        if (detection) {
          const box = detection.detection.box;
          
          // Extract extra features
          const clothingBox = {
            x: box.x,
            y: box.y + box.height,
            width: box.width,
            height: box.height * 1.5
          };
          const clothingGrid = extractColorGrid(previewVideoRef.current, clothingBox);
          
          const headBox = {
            x: box.x,
            y: box.y - box.height * 0.5,
            width: box.width,
            height: box.height * 0.5
          };
          const headGrid = extractColorGrid(previewVideoRef.current, headBox);
          
          const position = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
          
          collectedData.push({
            descriptor: detection.descriptor,
            extraFeatures: { clothingGrid, headGrid, position }
          });
          
          // Visual feedback
          const vw = previewVideoRef.current.videoWidth;
          const vh = previewVideoRef.current.videoHeight;
          setFaceBox({
            x: (box.x / vw) * 100,
            y: (box.y / vh) * 100,
            width: (box.width / vw) * 100,
            height: (box.height / vh) * 100,
            label: `เก็บข้อมูล ${collectedData.length}/${maxFrames}`,
            color: '#a855f7' // Purple for registration
          });
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (collectedData.length > 0) {
        // --- GEMINI AUTO-TAGGING ---
        let attributes = null;
        try {
          const canvas = document.createElement('canvas');
          canvas.width = previewVideoRef.current.videoWidth;
          canvas.height = previewVideoRef.current.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(previewVideoRef.current, 0, 0);
            const base64Image = canvas.toDataURL('image/jpeg', 0.8);
            const { extractAttributesWithGemini } = await import('../services/faceService');
            attributes = await extractAttributesWithGemini(base64Image);
          }
        } catch (err) {
          console.error("Auto-tagging error:", err);
        }

        for (const data of collectedData) {
          saveFaceToDB(targetName, data.descriptor, 'faceDB', { ...data.extraFeatures, attributes });
        }
        refreshIndexedFaces();
        const attrMsg = attributes ? ` (ตรวจพบ: ${attributes.shirtColor} ${attributes.shirtPattern})` : '';
        setToast({ show: true, msg: `บันทึกอัตลักษณ์ ${targetName} สำเร็จ (${collectedData.length} มุมมอง)${attrMsg}!`, type: 'success' });
        setTimeout(() => setFaceBox(null), 1000);
        return true;
      } else {
        setToast({ show: true, msg: `ไม่พบอัตลักษณ์ในวิดีโอ กรุณาลองใหม่`, type: 'error' });
        return false;
      }
    } catch (err) {
      console.error("Error in handleRegisterFace:", err);
      setToast({ show: true, msg: `เกิดข้อผิดพลาดในการบันทึกอัตลักษณ์`, type: 'error' });
      return false;
    } finally {
      setIsRegisteringFace(false);
      setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    }
  };

  const performFaceTracking = async () => {
    if (!videoRef.current || !isCapturingRef.current || !isFaceApiLoaded || isTrackingFaceRef.current || isProcessingFaceRef.current || isRegisteringFaceRef.current) return;
    
    isTrackingFaceRef.current = true;
    try {
      const box = await trackCenterFace(videoRef.current);
      if (box) {
        const vw = videoRef.current.videoWidth;
        const vh = videoRef.current.videoHeight;
        
        setFaceBox(prev => {
          if (!prev) return null; // Don't show box if recognition hasn't found a match yet
          if (prev.label === 'บันทึกสำเร็จ!') return prev;
          
          const faceCenterX = box.x + box.width / 2;
          const faceCenterY = box.y + box.height / 2;
          const targetWidth = box.width * 2.5;
          const targetHeight = box.height * 2.5;
          const expandedX = faceCenterX - targetWidth / 2;
          const expandedY = faceCenterY - targetHeight / 2;
          
          const newX = (expandedX / vw) * 100;
          const newY = (expandedY / vh) * 100;
          const newW = (targetWidth / vw) * 100;
          const newH = (targetHeight / vh) * 100;

          // Calculate IoU to check if it's the same face
          const xA = Math.max(prev.x, newX);
          const yA = Math.max(prev.y, newY);
          const xB = Math.min(prev.x + prev.width, newX + newW);
          const yB = Math.min(prev.y + prev.height, newY + newH);
          const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
          const box1Area = prev.width * prev.height;
          const box2Area = newW * newH;
          const iou = interArea / (box1Area + box2Area - interArea);

          // If IoU is too low, it's likely a different person or the face moved too fast
          if (iou < 0.2) {
            currentMetadataRef.current = null; // Clear metadata for new face
            return {
              x: newX,
              y: newY,
              width: newW,
              height: newH,
              label: 'กำลังตรวจสอบ...',
              color: '#f59e0b' // amber
            };
          }

          return {
            ...prev,
            x: newX,
            y: newY,
            width: newW,
            height: newH,
          };
        });
      } else {
        // If no face found, clear the face box and predictions related to face
        setFaceBox(null);
        faceResultBufferRef.current = [];
        faceMatchRef.current = null;
        currentMetadataRef.current = null;
        
        // Also clear predictions if they were only from face recognition
        setPredictions(prev => {
          // If we have OCR results, they will be updated by performOCR
          // For now, if no face, we can at least clear the face-specific part
          return prev.filter(p => !indexedFaces.includes(p));
        });
      }
    } catch (err) {
      console.error("Error in face tracking:", err);
    } finally {
      isTrackingFaceRef.current = false;
    }
  };

  const performMetadataExtraction = async () => {
    if (!videoRef.current || !isCapturingRef.current || !isFaceApiLoaded || isRegisteringFaceRef.current) return;
    
    // Only extract metadata if we have a face box (meaning a face is detected)
    if (!faceBoxRef.current) {
      currentMetadataRef.current = null;
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const base64Image = canvas.toDataURL('image/jpeg', 0.8);
      
      const { extractAttributesWithGemini } = await import('../services/faceService');
      const attributes = await extractAttributesWithGemini(base64Image);
      if (attributes) {
        currentMetadataRef.current = attributes;
      }
    } catch (err) {
      console.error("Error extracting metadata:", err);
    }
  };

  const performFaceRecognition = async () => {
    if (!videoRef.current || !isCapturingRef.current || !isFaceApiLoaded || isProcessingFaceRef.current || isRegisteringFaceRef.current) return;
    isProcessingFaceRef.current = true;
    const db = getFaceDB();
    
    try {
      // Get last face position in pixels for tracking stability
      let lastPos = null;
      if (faceBox && videoRef.current) {
        const vw = videoRef.current.videoWidth;
        const vh = videoRef.current.videoHeight;
        lastPos = {
          x: (faceBox.x / 100) * vw,
          y: (faceBox.y / 100) * vh,
          width: (faceBox.width / 100) * vw,
          height: (faceBox.height / 100) * vh
        };
      }

      const result = await recognizeFace(
        videoRef.current, 
        db, 
        faceThresholdRef.current, 
        useAutoContrastRef.current,
        lastPos,
        enableSuperRes,
        enableReIdRef.current,
        enableSpatialBiasRef.current,
        currentMetadataRef.current
      );
      
      if (result && result.box) {
        let currentMatch = result.match || 'Unknown';
        const videoW = videoRef.current.videoWidth;
        const videoH = videoRef.current.videoHeight;
        const faceCenterX = result.box.x + result.box.width / 2;
        const faceCenterY = result.box.y + result.box.height / 2;
        const normX = faceCenterX / videoW;
        const normY = faceCenterY / videoH;

        // --- SPATIAL BIAS LOGIC ---
        if (enableSpatialBias) {
          // Find nearest "seat"
          let bestSeatKey = null;
          let minSeatDist = 0.12; // 12% radius
          
          for (const [seatId, data] of Object.entries(spatialBiasRef.current) as [string, { name: string, count: number, x: number, y: number }][]) {
            const dist = Math.sqrt(Math.pow(normX - data.x, 2) + Math.pow(normY - data.y, 2));
            if (dist < minSeatDist) {
              minSeatDist = dist;
              bestSeatKey = seatId;
            }
          }

          if (currentMatch === 'Unknown' && bestSeatKey) {
            const seatData = spatialBiasRef.current[bestSeatKey];
            if (seatData.count > 15 && result.distance < faceThresholdRef.current * 1.5) {
              currentMatch = seatData.name;
            }
          }
          
          // Update seat data if we have a solid match
          if (currentMatch !== 'Unknown' && result.distance < faceThresholdRef.current * 0.9) {
            const seatKey = `${Math.round(normX * 10)}_${Math.round(normY * 10)}`;
            const existing = spatialBiasRef.current[seatKey] || { name: currentMatch, count: 0, x: normX, y: normY };
            if (existing.name === currentMatch) {
              existing.count = Math.min(100, existing.count + 1);
              existing.x = (existing.x * 0.95) + (normX * 0.05);
              existing.y = (existing.y * 0.95) + (normY * 0.05);
            } else {
              existing.count -= 2;
              if (existing.count <= 0) {
                spatialBiasRef.current[seatKey] = { name: currentMatch, count: 1, x: normX, y: normY };
              }
            }
            if (existing.count > 0) spatialBiasRef.current[seatKey] = existing;
          }
        }

        // --- RE-ID (CLOTHING & HAIR) LOGIC ---
        if (enableReIdRef.current) {
          const { extractColorGrid, calculateGridDistance } = await import('../services/faceService');
          
          const clothingBox = {
            x: result.box.x,
            y: result.box.y + result.box.height,
            width: result.box.width,
            height: result.box.height * 1.5
          };
          const clothingGrid = extractColorGrid(videoRef.current, clothingBox);
          
          const headBox = {
            x: result.box.x,
            y: result.box.y - result.box.height * 0.5,
            width: result.box.width,
            height: result.box.height * 0.5
          };
          const headGrid = extractColorGrid(videoRef.current, headBox);

          if (clothingGrid || headGrid) {
            // SESSION LOCK: If face is very clear, lock the clothing/head profile for this session
            if (currentMatch !== 'Unknown' && result.distance < faceThresholdRef.current * 0.7) {
              const profile = clothingProfilesRef.current[currentMatch] || {};
              if (clothingGrid) profile.clothingGrid = clothingGrid;
              if (headGrid) profile.headGrid = headGrid;
              profile.lastSeen = Date.now();
              profile.confidence = 1 - result.distance;
              clothingProfilesRef.current[currentMatch] = profile as any;
            } 
            // IDENTITY RECOVERY: If face is uncertain, try to recover using locked session profile
            else if (currentMatch === 'Unknown' || result.distance > faceThresholdRef.current * 0.9) {
              let bestProfileMatch = null;
              let minProfileDist = 0.22; // Strict threshold for pattern matching
              
              for (const [name, profile] of Object.entries(clothingProfilesRef.current) as [string, any][]) {
                // Only use profiles seen in the last 30 minutes
                if (Date.now() - (profile.lastSeen || 0) > 30 * 60 * 1000) continue;

                let totalDist = 0;
                let weight = 0;
                
                if (clothingGrid && profile.clothingGrid) {
                  totalDist += calculateGridDistance(clothingGrid, profile.clothingGrid);
                  weight += 1.5; // Weight clothing more
                }
                if (headGrid && profile.headGrid) {
                  totalDist += calculateGridDistance(headGrid, profile.headGrid);
                  weight += 1.0;
                }
                
                if (weight > 0) {
                  const avgDist = totalDist / weight;
                  if (avgDist < minProfileDist) {
                    minProfileDist = avgDist;
                    bestProfileMatch = name;
                  }
                }
              }
              
              if (bestProfileMatch) {
                // If we found a strong clothing match, override the unknown/uncertain face
                currentMatch = bestProfileMatch;
              }
            }
          }
        }

        // Smoothing logic (Temporal Smoothing / Voting)
        faceResultBufferRef.current.push(currentMatch);
        if (faceResultBufferRef.current.length > 3) faceResultBufferRef.current.shift();
        
        const counts = faceResultBufferRef.current.reduce((acc, val) => {
          acc[val] = (acc[val] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        let stableMatch = currentMatch;
        let maxCount = 0;
        Object.keys(counts).forEach(name => {
          const count = counts[name];
          if (count > maxCount) {
            maxCount = count;
            stableMatch = name;
          }
        });
        
        // Require at least 60% consensus to change the prediction
        const threshold = Math.ceil(faceResultBufferRef.current.length * 0.6);
        let finalMatch = currentMatch;
        
        // Use previous stable match if we don't have consensus
        const prevStableMatch = faceMatchRef.current?.name;
        const mappedPrevMatch = prevStableMatch === 'ไม่รู้จัก' ? 'Unknown' : prevStableMatch;
        
        if (maxCount >= threshold) {
          finalMatch = stableMatch;
        } else if (mappedPrevMatch) {
          finalMatch = mappedPrevMatch;
        }
        
        const isUnknown = finalMatch === 'Unknown';
        
        setFaceBox(prev => {
          if (prev && prev.label === 'บันทึกสำเร็จ!') return prev;
          
          const faceCenterX = result.box.x + result.box.width / 2;
          const faceCenterY = result.box.y + result.box.height / 2;
          
          // Use a fixed size for the UI display box as requested by user
          // This prevents the box from jittering or resizing constantly
          const targetWidth = (faceBoxWidth / 100) * videoW; 
          const targetHeight = (faceBoxHeight / 100) * videoH;
          
          let newLabel = isUnknown ? 'ไม่รู้จัก' : `${finalMatch} (${((1 - result.distance) * 100).toFixed(0)}%)`;
          let newColor = isUnknown ? '#ef4444' : '#10b981'; // green if match, red if unknown
          
          if (result.qualityError) {
            newLabel = result.qualityError === 'Blur' ? 'ภาพไม่ชัด (เบลอ)' : 'มุมหน้าไม่เหมาะสม (หันมากไป)';
            newColor = '#f59e0b'; // orange for warning
          }
          
          const debugData = result.debug;
          
          if (prev) {
            // Convert prev % back to pixels
            const prevW = (prev.width / 100) * videoW;
            const prevH = (prev.height / 100) * videoH;
            const prevX = (prev.x / 100) * videoW;
            const prevY = (prev.y / 100) * videoH;
            const prevCenterX = prevX + prevW / 2;
            const prevCenterY = prevY + prevH / 2;
            
            // Deadzone: If the face is still roughly in the center of the previous box 
            // keep the previous box position
            const dx = Math.abs(faceCenterX - prevCenterX);
            const dy = Math.abs(faceCenterY - prevCenterY);
            
            if (dx < prevW * 0.25 && dy < prevH * 0.25) {
              return {
                ...prev,
                label: newLabel,
                color: newColor,
                debug: debugData
              };
            }
          }
          
          // Otherwise, update the box to the new position and size
          const expandedX = faceCenterX - targetWidth / 2;
          const expandedY = faceCenterY - targetHeight / 2;
          
          return {
            x: (expandedX / videoW) * 100,
            y: (expandedY / videoH) * 100,
            width: (targetWidth / videoW) * 100,
            height: (targetHeight / videoH) * 100,
            label: newLabel,
            color: newColor,
            descriptor: result.descriptor, // Pass descriptor
            debug: debugData
          };
        });
        
        // Clear any existing timeout
        if (faceBoxTimeoutRef.current) {
          clearTimeout(faceBoxTimeoutRef.current);
        }
        
        // Set a timeout to clear the box if no face is detected for 3 seconds
        faceBoxTimeoutRef.current = window.setTimeout(() => {
          setFaceBox(prev => prev && prev.label !== 'บันทึกสำเร็จ!' ? null : prev);
          setFaceMatch(null);
          faceMatchRef.current = null;
        }, 3000);
        
        if (finalMatch) {
          const displayName = isUnknown ? 'ไม่รู้จัก' : finalMatch;
          const matchData = { name: displayName, confidence: 1 - result.distance };
          setFaceMatch(matchData);
          faceMatchRef.current = matchData;
          // Prepend to predictions if not already there
          setPredictions(prev => {
            // If OCR is disabled, only keep the face match
            if (!enableOCR) return [displayName];
            
            const others = prev.filter(p => p !== displayName);
            return [displayName, ...others];
          });
        } else {
          setFaceMatch(null);
          faceMatchRef.current = null;
        }
      } else {
        // No face detected in this frame
        faceResultBufferRef.current = [];
        
        // Clear face-related predictions if no face is seen
        setPredictions(prev => prev.filter(p => !indexedFaces.includes(p) && p !== 'ไม่รู้จัก'));
      }
    } catch (err) {
      console.error("Face Recognition Error:", err);
    } finally {
      isProcessingFaceRef.current = false;
    }
  };

  const performOCR = async () => {
    if (!videoRef.current || !canvasRef.current || !workerRef.current || !isCapturingRef.current || isProcessingOCRRef.current || !enableOCR) return;

    isProcessingOCRRef.current = true;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      isProcessingOCRRef.current = false;
      return;
    }

    // Calculate actual crop dimensions based on video intrinsic size
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    
    if (videoWidth === 0 || videoHeight === 0) return;

    const currentCropBox = cropBoxRef.current;
    const cropX = (currentCropBox.x / 100) * videoWidth;
    const cropY = (currentCropBox.y / 100) * videoHeight;
    const cropW = (currentCropBox.width / 100) * videoWidth;
    const cropH = (currentCropBox.height / 100) * videoHeight;

    canvas.width = cropW;
    canvas.height = cropH;

    // Draw cropped region to canvas
    ctx.drawImage(
      video,
      cropX, cropY, cropW, cropH, // Source rect
      0, 0, cropW, cropH          // Dest rect
    );

    // Get image data for comparison
    const currentImageData = ctx.getImageData(0, 0, cropW, cropH);
    
    // Compare with previous image data to save processing power
    if (lastImageDataRef.current && 
        lastImageDataRef.current.width === cropW && 
        lastImageDataRef.current.height === cropH) {
      
      let diffCount = 0;
      const totalPixels = currentImageData.data.length / 4;
      // Check every 4th pixel to speed up comparison
      for (let i = 0; i < currentImageData.data.length; i += 16) {
        const rDiff = Math.abs(currentImageData.data[i] - lastImageDataRef.current.data[i]);
        const gDiff = Math.abs(currentImageData.data[i+1] - lastImageDataRef.current.data[i+1]);
        const bDiff = Math.abs(currentImageData.data[i+2] - lastImageDataRef.current.data[i+2]);
        
        // If pixel difference is significant (threshold 50 out of 255)
        if (rDiff + gDiff + bDiff > 50) {
          diffCount++;
        }
      }
      
      // We checked 1/4 of the pixels, so adjust the total
      const pixelsChecked = totalPixels / 4;
      const diffPercentage = (diffCount / pixelsChecked) * 100;
      
      // If difference is less than 2%, skip OCR
      if (diffPercentage < 2) {
        return;
      }
    }

    lastImageDataRef.current = currentImageData;

    if (!enableOCR) return;

    setIsProcessingOCR(true);
    isProcessingOCRRef.current = true;

    try {
      // --- IMAGE ENHANCEMENT FOR OCR ---
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        // Simple thresholding to increase contrast for OCR
        const val = gray > 128 ? 255 : 0;
        data[i] = data[i + 1] = data[i + 2] = val;
      }
      ctx.putImageData(imageData, 0, 0);

      const { data: { text } } = await workerRef.current.recognize(canvas);
      
      // Clean up raw text to remove common OCR noise
      const cleanedText = text
        .replace(/[^\u0E00-\u0E7Fa-zA-Z0-9\s.-]/g, '') // Keep only Thai, English, numbers, spaces, dots, hyphens
        .replace(/\s+/g, ' ') // Replace multiple spaces with single space
        .trim();
        
      setRawText(cleanedText);
      
      const currentSpeakerList = combinedListRef.current;
      let matches: string[] = [];
      
      if (cleanedText) {
        // Use a more strict similarity threshold for automatic matching
        const fuzzyMatches = currentSpeakerList.length > 0 
          ? getBestMatches(cleanedText, currentSpeakerList, 3)
          : [];
        
        // Check if cleanedText is an exact match in the list (after formatting)
        const formattedCleaned = formatSpeakerName(cleanedText);
        const isExactMatch = currentSpeakerList.some(s => formatSpeakerName(s) === formattedCleaned);
        
        // Calculate similarity with the best fuzzy match
        const bestFuzzy = fuzzyMatches[0];
        const similarity = bestFuzzy ? calculateSimilarity(cleanedText, bestFuzzy) : 0;
        
        // If not exact match AND similarity is low (< 60%), put raw OCR first as "New"
        // Lowered threshold from 0.75 to 0.60 to be more lenient with OCR errors but still require some match
        if (!isExactMatch && similarity < 0.60 && cleanedText.length > 2) {
          matches = [cleanedText, ...fuzzyMatches.filter(m => m !== cleanedText)];
        } else {
          matches = fuzzyMatches;
        }
      }
      
      // --- VOTING SYSTEM ---
      // To reduce jitter and false positives, we use a simple voting system
      if (matches.length > 0) {
        predictionHistoryRef.current.push(matches[0]);
        if (predictionHistoryRef.current.length > 3) {
          predictionHistoryRef.current.shift();
        }
        
        // Count occurrences in history
        const counts: {[key: string]: number} = {};
        predictionHistoryRef.current.forEach(name => {
          counts[name] = (counts[name] || 0) + 1;
        });
        
        // Find the most frequent name
        let mostFrequent = matches[0];
        let maxCount = 0;
        for (const name in counts) {
          if (counts[name] > maxCount) {
            maxCount = counts[name];
            mostFrequent = name;
          }
        }
        
        // Only update if the name is stable (appears at least 3 out of 5 times)
        if (maxCount >= 3) {
          const stableMatches = [mostFrequent, ...matches.filter(m => m !== mostFrequent)];
          setPredictions(prev => {
            const currentFaceMatch = faceMatchRef.current;
            
            // If OCR is disabled, we should only have face match (if any)
            if (!enableOCR) {
              return currentFaceMatch ? [currentFaceMatch.name] : [];
            }

            if (currentFaceMatch) {
              const others = stableMatches.filter(m => m !== currentFaceMatch.name);
              return [currentFaceMatch.name, ...others];
            }
            return stableMatches;
          });
        }
      } else {
        setPredictions([]);
      }
    } catch (err) {
      console.error("OCR Error:", err);
    } finally {
      setIsProcessingOCR(false);
      isProcessingOCRRef.current = false;
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Add to List Modal */}
      {addModal.isOpen && (
        <div className="fixed inset-0 bg-black/20 flex items-start justify-end z-[100] p-4 pointer-events-none">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-[320px] overflow-hidden animate-in slide-in-from-right-4 duration-200 pointer-events-auto border border-gray-200">
            <div className="bg-blue-600 text-white p-3 flex justify-between items-center">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <UserPlus size={16} />
                เพิ่มรายชื่อใหม่
              </h4>
              <button onClick={() => setAddModal({ ...addModal, isOpen: false })} className="hover:bg-blue-700 p-1 rounded">
                <X size={16} />
              </button>
            </div>
            
            <div className="p-4 flex flex-col gap-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">ชื่อ-นามสกุล</label>
                <input 
                  type="text"
                  list="speaker-names-list"
                  className="w-full text-sm font-bold text-gray-800 bg-gray-50 p-2 rounded border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  value={addModal.name}
                  onChange={(e) => setAddModal({ ...addModal, name: e.target.value })}
                  placeholder="พิมพ์ชื่อใหม่..."
                  autoFocus
                />
                <datalist id="speaker-names-list">
                  {[...senatorList, ...speakerList].map((name, i) => (
                    <option key={i} value={name} />
                  ))}
                </datalist>
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">ประเภท</label>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => setAddModal({ ...addModal, category: 'speakers' })}
                    className={`py-2 px-2 rounded-lg border font-bold text-xs transition-all ${
                      addModal.category === 'speakers' 
                        ? 'border-blue-600 bg-blue-50 text-blue-600' 
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    ผู้อภิปราย
                  </button>
                  <button 
                    onClick={() => setAddModal({ ...addModal, category: 'senators' })}
                    className={`py-2 px-2 rounded-lg border font-bold text-xs transition-all ${
                      addModal.category === 'senators' 
                        ? 'border-blue-600 bg-blue-50 text-blue-600' 
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    สว.
                  </button>
                </div>
              </div>
              
              <div className="flex flex-col gap-2 mt-1">
                <button 
                  onClick={async () => {
                    if (!addModal.name.trim()) {
                      setToast({ show: true, msg: `กรุณาระบุชื่อ`, type: 'error' });
                      setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
                      return;
                    }

                    const { name, category } = addModal;
                    const formattedName = formatSpeakerName(name);
                    const currentList = category === 'senators' ? senatorList : speakerList;
                    const setList = category === 'senators' ? setSenatorList : setSpeakerList;
                    
                    const isSenator = senatorList.includes(formattedName);
                    const isSpeaker = speakerList.includes(formattedName);
                    
                    if (isSenator || isSpeaker) {
                      setPredictions(prev => {
                        const others = prev.filter(p => p !== formattedName);
                        return [formattedName, ...others];
                      });
                    } else {
                      setList([...currentList, formattedName]);
                      setPredictions(prev => {
                        const others = prev.filter(p => p !== formattedName);
                        return [formattedName, ...others];
                      });
                    }
                    
                    // Trigger face registration
                    const success = await handleRegisterFace(formattedName);
                    
                    // Only close modal if registration was successful
                    if (success) {
                      setAddModal({ ...addModal, isOpen: false });
                    }
                  }}
                  disabled={isRegisteringFace || !isFaceApiLoaded}
                  className="w-full py-3 bg-purple-600 text-white rounded-lg font-bold hover:bg-purple-700 shadow-md shadow-purple-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isRegisteringFace ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Camera size={18} />
                  )}
                  บันทึกชื่อและจำอัตลักษณ์
                </button>
                
                <div className="flex gap-3">
                  <button 
                    onClick={() => setAddModal({ ...addModal, isOpen: false })}
                    className="flex-1 py-3 border border-gray-300 rounded-lg font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button 
                    onClick={() => {
                      if (!addModal.name.trim()) {
                        setToast({ show: true, msg: `กรุณาระบุชื่อ`, type: 'error' });
                        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
                        return;
                      }

                      const { name, category } = addModal;
                      const formattedName = formatSpeakerName(name);
                      const currentList = category === 'senators' ? senatorList : speakerList;
                      const setList = category === 'senators' ? setSenatorList : setSpeakerList;
                      
                      const isSenator = senatorList.includes(formattedName);
                      const isSpeaker = speakerList.includes(formattedName);
                      
                      if (isSenator || isSpeaker) {
                        setPredictions(prev => {
                          const others = prev.filter(p => p !== formattedName);
                          return [formattedName, ...others];
                        });
                        setToast({ show: true, msg: `เลือกรายชื่อ ${formattedName} แล้ว`, type: 'success' });
                      } else {
                        setList([...currentList, formattedName]);
                        setPredictions(prev => {
                          const others = prev.filter(p => p !== formattedName);
                          return [formattedName, ...others];
                        });
                        setToast({ show: true, msg: `เพิ่มรายชื่อสำเร็จ!`, type: 'success' });
                      }
                      
                      setAddModal({ ...addModal, isOpen: false });
                      setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
                    }}
                    className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-md shadow-blue-200 transition-all"
                  >
                    บันทึกชื่อเท่านั้น
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[110] px-6 py-3 rounded-full shadow-xl flex items-center gap-2 animate-in slide-in-from-bottom-4 duration-300 ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
          <span className="font-bold text-sm">{toast.msg}</span>
        </div>
      )}

      {/* Invisible video for OCR to prevent browser pausing when minimized */}
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted 
        className="fixed top-0 left-0 w-[320px] h-[180px] opacity-[0.01] pointer-events-none z-[-1]"
      />

      <div className={`fixed ${isMinimized ? 'bottom-4 right-4 w-[420px]' : `top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${!stream ? 'w-[500px]' : 'w-[800px]'} max-w-[95vw] max-h-[90vh]`} bg-white rounded-xl shadow-2xl z-50 overflow-hidden border border-gray-200 flex flex-col transition-all duration-300`}>
        {/* Header */}
      <div className="bg-blue-600 text-white p-3 flex justify-between items-center cursor-move shrink-0">
        <h3 className="font-bold flex items-center gap-2">
          <Crosshair size={18} />
          ระบบเดาชื่อผู้พูด (OCR)
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsMinimized(!isMinimized)} className="hover:bg-blue-700 p-1 rounded">
            {isMinimized ? <Maximize size={16} /> : <Minimize size={16} />}
          </button>
          <button onClick={onClose} className="hover:bg-blue-700 p-1 rounded">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className={isMinimized ? 'hidden' : 'p-4 flex flex-col gap-4 overflow-y-auto flex-1'}>
          {/* Controls */}
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              {isCapturing && (
                <button 
                  onClick={stopCapture} 
                  className="flex items-center gap-2 bg-red-600 text-white px-4 py-2.5 rounded-lg hover:bg-red-700 text-sm font-bold shadow-md shadow-red-100 transition-all active:scale-95"
                >
                  <Square size={18} fill="currentColor" /> หยุดอ่าน
                </button>
              )}
            </div>
            <button 
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all shadow-sm border ${
                isSettingsOpen 
                  ? 'bg-blue-600 text-white border-blue-600 ring-4 ring-blue-100' 
                  : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300'
              } active:scale-95`}
            >
              <Settings size={18} className={isSettingsOpen ? 'animate-spin-slow' : ''} /> 
              {isSettingsOpen ? 'ปิดตั้งค่า' : 'ตั้งค่ารายชื่อตั้งต้น'}
            </button>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative text-sm flex justify-between items-center">
              <span className="block sm:inline">{errorMsg}</span>
              <button onClick={() => setErrorMsg(null)} className="text-red-700 hover:text-red-900">
                <X size={16} />
              </button>
            </div>
          )}

          {/* Settings Panel */}
          {isSettingsOpen && (
            <div className="bg-gray-50 p-4 rounded border border-gray-200 flex flex-col gap-4">
              {/* Tabs */}
              <div className="flex bg-gray-200 p-1 rounded-lg">
                <button 
                  onClick={() => { setActiveTab('senators'); setEditingSpeaker(null); }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                    activeTab === 'senators' 
                      ? 'bg-white text-blue-600 shadow-sm' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  สมาชิกวุฒิสภา
                </button>
                <button 
                  onClick={() => { setActiveTab('speakers'); setEditingSpeaker(null); }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                    activeTab === 'speakers' 
                      ? 'bg-white text-blue-600 shadow-sm' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  ผู้อภิปราย
                </button>
                <button 
                  onClick={() => { setActiveTab('faces'); setEditingSpeaker(null); }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                    activeTab === 'faces' 
                      ? 'bg-white text-purple-600 shadow-sm' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  ฐานข้อมูลอัตลักษณ์
                </button>
                <button 
                  onClick={() => { setActiveTab('settings'); setEditingSpeaker(null); }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${
                    activeTab === 'settings' 
                      ? 'bg-white text-orange-600 shadow-sm' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  ตั้งค่าระบบ
                </button>
              </div>

              {activeTab !== 'faces' && activeTab !== 'settings' && (
                <div className="flex justify-between items-center">
                  <label className="text-sm font-bold text-gray-700">
                    {activeTab === 'senators' ? 'รายชื่อผู้อภิปราย' : 'รายชื่อสมาชิกวุฒิสภา'} ({activeTab === 'senators' ? senatorList.length : speakerList.length})
                  </label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      setConfirmDialog({
                        show: true,
                        message: 'คุณต้องการสลับรายชื่อทั้งหมดระหว่าง "สมาชิกวุฒิสภา" และ "ผู้อภิปราย" หรือไม่?',
                        onConfirm: () => {
                          const temp = [...senatorList];
                          setSenatorList([...speakerList]);
                          setSpeakerList(temp);
                        }
                      });
                    }}
                    className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1 font-medium"
                  >
                    <RotateCcw size={12} /> สลับกลุ่ม
                  </button>
                  <button 
                    onClick={() => {
                      setConfirmDialog({
                        show: true,
                        message: 'คุณแน่ใจหรือไม่ว่าต้องการล้างรายชื่อส่วนนี้ทั้งหมด?',
                        onConfirm: () => {
                          if (activeTab === 'senators') setSenatorList([]);
                          else setSpeakerList([]);
                        }
                      });
                    }}
                    className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 font-medium"
                  >
                    <Trash2 size={12} /> ล้างทั้งหมด
                  </button>
                </div>
              </div>
              )}

              {/* Add New Speaker */}
              {activeTab !== 'faces' && activeTab !== 'settings' && (
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input 
                      type="text"
                      className="w-full pl-3 pr-3 py-2 border rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder={`เพิ่มรายชื่อ${activeTab === 'senators' ? 'สมาชิกวุฒิสภา' : 'ผู้อภิปราย'}ใหม่...`}
                      value={newSpeakerInput}
                      onChange={(e) => setNewSpeakerInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newSpeakerInput.trim()) {
                          const trimmed = newSpeakerInput.trim();
                          const currentList = activeTab === 'senators' ? senatorList : speakerList;
                          const setList = activeTab === 'senators' ? setSenatorList : setSpeakerList;
                          
                          if (!currentList.includes(trimmed)) {
                            setList([...currentList, trimmed]);
                          }
                          setNewSpeakerInput('');
                        }
                      }}
                    />
                  </div>
                  <button 
                    onClick={() => {
                      if (newSpeakerInput.trim()) {
                        const trimmed = newSpeakerInput.trim();
                        const currentList = activeTab === 'senators' ? senatorList : speakerList;
                        const setList = activeTab === 'senators' ? setSenatorList : setSpeakerList;
                        
                        if (!currentList.includes(trimmed)) {
                          setList([...currentList, trimmed]);
                        }
                        setNewSpeakerInput('');
                      }
                    }}
                    className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    title="เพิ่มรายชื่อ"
                  >
                    <Plus size={18} />
                  </button>
                </div>
                
                <div className="flex flex-col gap-2">
                  <button 
                    onClick={() => setShowBulkImport(!showBulkImport)}
                    className={`w-full py-1.5 rounded text-[10px] font-bold flex items-center justify-center gap-1 transition-colors ${
                      showBulkImport ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    <ArrowDownToLine size={12} /> นำเข้าแบบกลุ่ม
                  </button>

                  {showBulkImport && (
                    <div className="flex flex-col gap-2 p-2 bg-gray-50 rounded border border-gray-200">
                      <textarea
                        className="w-full p-2 border rounded text-xs h-24 focus:ring-1 focus:ring-blue-400 outline-none"
                        placeholder="วางรายชื่อที่นี่... (แยกด้วยบรรทัดใหม่ หรือ เครื่องหมายจุลภาค)"
                        value={bulkInput}
                        onChange={(e) => setBulkInput(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            if (bulkInput.trim()) {
                              const names = bulkInput.split(/[\n,]/).map(n => n.trim()).filter(n => n.length > 0);
                              if (names.length > 0) {
                                const currentList = activeTab === 'senators' ? senatorList : speakerList;
                                const setList = activeTab === 'senators' ? setSenatorList : setSpeakerList;
                                const newList = [...currentList];
                                let addedCount = 0;
                                names.forEach(name => {
                                  const formatted = formatSpeakerName(name);
                                  if (!newList.includes(formatted)) {
                                    newList.push(formatted);
                                    addedCount++;
                                  }
                                });
                                setList(newList);
                                setToast({ show: true, msg: `นำเข้าสำเร็จ ${addedCount} รายชื่อ!`, type: 'success' });
                                setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
                                setBulkInput('');
                                setShowBulkImport(false);
                              }
                            }
                          }}
                          className="flex-1 py-1.5 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700"
                        >
                          เพิ่มรายชื่อทั้งหมด
                        </button>
                        <button
                          onClick={() => setShowBulkImport(false)}
                          className="px-3 py-1.5 bg-gray-200 text-gray-600 rounded text-xs font-bold hover:bg-gray-300"
                        >
                          ยกเลิก
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              )}

              {/* Search/Filter */}
              {activeTab !== 'faces' && activeTab !== 'settings' && (
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="text"
                  className="w-full pl-9 pr-3 py-1.5 border border-gray-200 rounded-md text-xs focus:ring-1 focus:ring-blue-400 outline-none"
                  placeholder="ค้นหาในรายการ..."
                  value={speakerSearchQuery}
                  onChange={(e) => setSpeakerSearchQuery(e.target.value)}
                />
              </div>
              )}

              {/* Speaker List */}
              {activeTab !== 'faces' && activeTab !== 'settings' && (
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded bg-white">
                  {((activeTab === 'senators' ? senatorList : speakerList).length === 0) ? (
                  <div className="p-4 text-center text-gray-400 text-xs italic">ยังไม่มีรายชื่อในรายการ</div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {(activeTab === 'senators' ? senatorList : speakerList)
                      .filter(s => s.toLowerCase().includes(speakerSearchQuery.toLowerCase()))
                      .map((speaker, idx) => {
                        const originalIndex = (activeTab === 'senators' ? senatorList : speakerList).indexOf(speaker);
                        return (
                          <div key={idx} className="flex justify-between items-center p-2 hover:bg-gray-50 group">
                            {editingSpeaker?.index === originalIndex ? (
                              <div className="flex flex-1 gap-1">
                                <input 
                                  type="text"
                                  autoFocus
                                  className="flex-1 px-2 py-0.5 border rounded text-sm outline-none focus:ring-1 focus:ring-blue-400"
                                  value={editingSpeaker.value}
                                  onChange={(e) => setEditingSpeaker({ ...editingSpeaker, value: e.target.value })}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const currentList = activeTab === 'senators' ? senatorList : speakerList;
                                      const setList = activeTab === 'senators' ? setSenatorList : setSpeakerList;
                                      const newList = [...currentList];
                                      newList[originalIndex] = editingSpeaker.value.trim();
                                      setList(newList.filter(s => s !== ''));
                                      setEditingSpeaker(null);
                                    } else if (e.key === 'Escape') {
                                      setEditingSpeaker(null);
                                    }
                                  }}
                                />
                                <button 
                                  onClick={() => {
                                    const currentList = activeTab === 'senators' ? senatorList : speakerList;
                                    const setList = activeTab === 'senators' ? setSenatorList : setSpeakerList;
                                    const newList = [...currentList];
                                    newList[originalIndex] = editingSpeaker.value.trim();
                                    setList(newList.filter(s => s !== ''));
                                    setEditingSpeaker(null);
                                  }}
                                  className="p-1 text-green-600 hover:bg-green-50 rounded"
                                >
                                  <Check size={14} />
                                </button>
                              </div>
                            ) : (
                              <>
                                <span className="text-sm text-gray-700 truncate flex-1">
                                  <span className="text-gray-400 mr-2 tabular-nums">{idx + 1}.</span>
                                  {speaker}
                                </span>
                                <div className="flex gap-1 transition-all">
                                  <button 
                                    onClick={() => setEditingSpeaker({ index: originalIndex, value: speaker })}
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded border border-transparent hover:border-blue-200"
                                    title="แก้ไข"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button 
                                    onClick={() => {
                                      const currentList = activeTab === 'senators' ? senatorList : speakerList;
                                      const setList = activeTab === 'senators' ? setSenatorList : setSpeakerList;
                                      setList(currentList.filter((_, i) => i !== originalIndex));
                                    }}
                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded border border-transparent hover:border-red-200"
                                    title="ลบ"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })
                    }
                  </div>
                )}
              </div>
              )}
              
              {/* Face DB List */}
              {activeTab === 'faces' && (
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-bold text-gray-700">
                      อัตลักษณ์ที่บันทึกไว้ ({indexedFaces.length})
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={exportAutoSpeakerData}
                        className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1 font-medium"
                      >
                        <ArrowDownToLine size={12} /> ส่งออก
                      </button>
                      <label className="text-xs text-green-500 hover:text-green-700 flex items-center gap-1 font-medium cursor-pointer">
                        <ArrowDownToLine size={12} className="rotate-180" /> นำเข้า
                        <input
                          type="file"
                          accept=".json"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              importAutoSpeakerData(file);
                            }
                            e.target.value = '';
                          }}
                        />
                      </label>
                      <button 
                        onClick={() => {
                          setConfirmDialog({
                            show: true,
                            message: 'คุณแน่ใจหรือไม่ว่าต้องการล้างฐานข้อมูลอัตลักษณ์ทั้งหมด?',
                            onConfirm: () => {
                              clearFaceDB('faceDB');
                              refreshIndexedFaces();
                              setToast({ show: true, msg: 'ล้างฐานข้อมูลอัตลักษณ์สำเร็จ', type: 'success' });
                              setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
                            }
                          });
                        }}
                        className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 font-medium"
                      >
                        <Trash2 size={12} /> ล้างทั้งหมด
                      </button>
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded bg-white">
                    {indexedFaces.length === 0 ? (
                      <div className="p-4 text-center text-gray-400 text-xs italic">ยังไม่มีข้อมูลอัตลักษณ์</div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {indexedFaces.map((faceName, idx) => {
                          const db = getFaceDB();
                          const entry = db[faceName];
                          const count = entry ? (Array.isArray(entry) ? (typeof entry[0] === 'number' ? 1 : entry.length) : (entry.descriptors ? entry.descriptors.length : 0)) : 0;
                          const attributes = entry && !Array.isArray(entry) ? entry.attributes : null;
                          
                          return (
                            <div key={idx} className="flex flex-col p-2 hover:bg-gray-50 group border-b border-gray-50 last:border-0">
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-700 truncate flex-1 flex items-center gap-2 font-bold">
                                  <ScanFace size={14} className="text-purple-500" />
                                  {faceName} <span className="text-[10px] text-gray-400 font-normal">({count} ภาพ)</span>
                                </span>
                                <button 
                                  onClick={() => {
                                    setConfirmDialog({
                                      show: true,
                                      message: `ลบข้อมูลอัตลักษณ์ของ ${faceName} ใช่หรือไม่?`,
                                      onConfirm: () => {
                                        deleteFaceFromDB(faceName);
                                        refreshIndexedFaces();
                                      }
                                    });
                                  }}
                                  className="p-1.5 text-red-600 hover:bg-red-50 rounded border border-transparent hover:border-red-200"
                                  title="ลบข้อมูลอัตลักษณ์"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                              {attributes && (
                                <div className="flex flex-wrap gap-1 mt-1 pl-6">
                                  {attributes.gender && (
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded border flex items-center gap-1 ${
                                      attributes.gender === 'ชาย' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-pink-50 text-pink-600 border-pink-100'
                                    }`}>
                                      {attributes.gender}
                                    </span>
                                  )}
                                  {attributes.shirtColor && (
                                    <span className="text-[9px] bg-gray-50 text-gray-600 px-1.5 py-0.5 rounded border border-gray-100 flex items-center gap-1">
                                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: attributes.shirtColor.toLowerCase() }} />
                                      เสื้อ{attributes.shirtColor} {attributes.shirtPattern === 'solid' ? 'สีพื้น' : attributes.shirtPattern}
                                    </span>
                                  )}
                                  {attributes.hairStyle && (
                                    <span className="text-[9px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded border border-purple-100">
                                      {attributes.hairStyle}
                                    </span>
                                  )}
                                  {attributes.wearingGlasses && (
                                    <span className="text-[9px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded border border-orange-100">
                                      ใส่แว่น
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* System Settings Tab */}
              {activeTab === 'settings' && (
                <div className="flex flex-col gap-3">
                  <div className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-bold text-gray-700">ความแม่นยำในการจำแนกอัตลักษณ์ (Threshold)</label>
                      <span className="text-xs font-mono bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200">
                        {faceThreshold.toFixed(2)}
                      </span>
                    </div>
                    <input 
                      type="range" 
                      min="0.30" 
                      max="0.80" 
                      step="0.01" 
                      value={faceThreshold} 
                      onChange={(e) => setFaceThreshold(parseFloat(e.target.value))}
                      className="w-full accent-purple-500"
                    />
                    <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                      <span>เข้มงวดมาก (0.30)</span>
                      <span className="text-blue-600 font-bold">แนะนำ (0.50-0.60)</span>
                      <span>ยืดหยุ่น (0.80)</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-gray-700">ปรับแสงอัตโนมัติ (Auto Contrast)</label>
                        <div className="relative inline-block w-8 mr-2 align-middle select-none transition duration-200 ease-in">
                          <input 
                            type="checkbox" 
                            name="toggle" 
                            id="autoContrastToggle" 
                            checked={useAutoContrast}
                            onChange={(e) => setUseAutoContrast(e.target.checked)}
                            className="toggle-checkbox absolute block w-4 h-4 rounded-full bg-white border-4 appearance-none cursor-pointer"
                            style={{
                              right: useAutoContrast ? '0' : '1rem',
                              borderColor: useAutoContrast ? '#a855f7' : '#d1d5db',
                              transition: 'right 0.2s ease-in-out, border-color 0.2s ease-in-out'
                            }}
                          />
                          <label 
                            htmlFor="autoContrastToggle" 
                            className="toggle-label block overflow-hidden h-4 rounded-full bg-gray-300 cursor-pointer"
                            style={{
                              backgroundColor: useAutoContrast ? '#a855f7' : '#d1d5db',
                              transition: 'background-color 0.2s ease-in-out'
                            }}
                          ></label>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-400 leading-tight">
                        * ช่วยเพิ่มความแม่นยำในกรณีที่ย้อนแสงหรือหน้ามืด
                      </p>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-gray-700">โหมดตรวจสอบ (Debug Mode)</label>
                        <div className="relative inline-block w-8 mr-2 align-middle select-none transition duration-200 ease-in">
                          <input 
                            type="checkbox" 
                            name="toggle" 
                            id="debugModeToggle" 
                            checked={isDebugMode}
                            onChange={(e) => setIsDebugMode(e.target.checked)}
                            className="toggle-checkbox absolute block w-4 h-4 rounded-full bg-white border-4 appearance-none cursor-pointer"
                            style={{
                              right: isDebugMode ? '0' : '1rem',
                              borderColor: isDebugMode ? '#3b82f6' : '#d1d5db',
                              transition: 'right 0.2s ease-in-out, border-color 0.2s ease-in-out'
                            }}
                          />
                          <label 
                            htmlFor="debugModeToggle" 
                            className="toggle-label block overflow-hidden h-4 rounded-full bg-gray-300 cursor-pointer"
                            style={{
                              backgroundColor: isDebugMode ? '#3b82f6' : '#d1d5db',
                              transition: 'background-color 0.2s ease-in-out'
                            }}
                          ></label>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-400 leading-tight">
                        * แสดงค่าทางเทคนิค (Distance, Pose, Blur)
                      </p>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-gray-700">ระบบอ่านชื่อ (OCR Detection)</label>
                        <div className="relative inline-block w-8 mr-2 align-middle select-none transition duration-200 ease-in">
                          <input 
                            type="checkbox" 
                            name="toggle" 
                            id="ocrToggle" 
                            checked={enableOCR}
                            onChange={(e) => setEnableOCR(e.target.checked)}
                            className="toggle-checkbox absolute block w-4 h-4 rounded-full bg-white border-4 appearance-none cursor-pointer"
                            style={{
                              right: enableOCR ? '0' : '1rem',
                              borderColor: enableOCR ? '#3b82f6' : '#d1d5db',
                              transition: 'right 0.2s ease-in-out, border-color 0.2s ease-in-out'
                            }}
                          />
                          <label 
                            htmlFor="ocrToggle" 
                            className="toggle-label block overflow-hidden h-4 rounded-full bg-gray-300 cursor-pointer"
                            style={{
                              backgroundColor: enableOCR ? '#3b82f6' : '#d1d5db',
                              transition: 'background-color 0.2s ease-in-out'
                            }}
                          ></label>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-400 leading-tight">
                        * ตรวจจับชื่อจากแถบชื่อในวิดีโอ
                      </p>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-gray-700">ระบบ Re-ID (Body/Clothing)</label>
                        <div className="relative inline-block w-8 mr-2 align-middle select-none transition duration-200 ease-in">
                          <input 
                            type="checkbox" 
                            name="toggle" 
                            id="reIdToggle" 
                            checked={enableReId}
                            onChange={(e) => setEnableReId(e.target.checked)}
                            className="toggle-checkbox absolute block w-4 h-4 rounded-full bg-white border-4 appearance-none cursor-pointer"
                            style={{
                              right: enableReId ? '0' : '1rem',
                              borderColor: enableReId ? '#10b981' : '#d1d5db',
                              transition: 'right 0.2s ease-in-out, border-color 0.2s ease-in-out'
                            }}
                          />
                          <label 
                            htmlFor="reIdToggle" 
                            className="toggle-label block overflow-hidden h-4 rounded-full bg-gray-300 cursor-pointer"
                            style={{
                              backgroundColor: enableReId ? '#10b981' : '#d1d5db',
                              transition: 'background-color 0.2s ease-in-out'
                            }}
                          ></label>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-400 leading-tight">
                        * ช่วยจำเอกลักษณ์จากสีเสื้อผ้า
                      </p>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-gray-700">เพิ่มความชัดอัตลักษณ์ (Super-Res)</label>
                        <div className="relative inline-block w-8 mr-2 align-middle select-none transition duration-200 ease-in">
                          <input 
                            type="checkbox" 
                            name="toggle" 
                            id="superResToggle" 
                            checked={enableSuperRes}
                            onChange={(e) => setEnableSuperRes(e.target.checked)}
                            className="toggle-checkbox absolute block w-4 h-4 rounded-full bg-white border-4 appearance-none cursor-pointer"
                            style={{
                              right: enableSuperRes ? '0' : '1rem',
                              borderColor: enableSuperRes ? '#f59e0b' : '#d1d5db',
                              transition: 'right 0.2s ease-in-out, border-color 0.2s ease-in-out'
                            }}
                          />
                          <label 
                            htmlFor="superResToggle" 
                            className="toggle-label block overflow-hidden h-4 rounded-full bg-gray-300 cursor-pointer"
                            style={{
                              backgroundColor: enableSuperRes ? '#f59e0b' : '#d1d5db',
                              transition: 'background-color 0.2s ease-in-out'
                            }}
                          ></label>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-400 leading-tight">
                        * ปรับปรุงความคมชัดของอัตลักษณ์ (ใช้ CPU เพิ่มขึ้น)
                      </p>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-gray-700">จำตำแหน่งที่นั่ง (Spatial Bias)</label>
                        <div className="relative inline-block w-8 mr-2 align-middle select-none transition duration-200 ease-in">
                          <input 
                            type="checkbox" 
                            name="toggle" 
                            id="spatialBiasToggle" 
                            checked={enableSpatialBias}
                            onChange={(e) => setEnableSpatialBias(e.target.checked)}
                            className="toggle-checkbox absolute block w-4 h-4 rounded-full bg-white border-4 appearance-none cursor-pointer"
                            style={{
                              right: enableSpatialBias ? '0' : '1rem',
                              borderColor: enableSpatialBias ? '#3b82f6' : '#d1d5db',
                              transition: 'right 0.2s ease-in-out, border-color 0.2s ease-in-out'
                            }}
                          />
                          <label 
                            htmlFor="spatialBiasToggle" 
                            className="toggle-label block overflow-hidden h-4 rounded-full bg-gray-300 cursor-pointer"
                            style={{
                              backgroundColor: enableSpatialBias ? '#3b82f6' : '#d1d5db',
                              transition: 'background-color 0.2s ease-in-out'
                            }}
                          ></label>
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-400 leading-tight">
                        * ใช้ประวัติการนั่งช่วยในการระบุตัวตน
                      </p>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 mt-2">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-bold text-gray-700">ขนาดกรอบจับอัตลักษณ์ (Face Box Size)</label>
                    </div>
                    
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-gray-500">ความกว้าง (Width)</span>
                          <span className="font-mono text-blue-600">{faceBoxWidth.toFixed(0)}%</span>
                        </div>
                        <input 
                          type="range" 
                          min="10" 
                          max="60" 
                          step="1" 
                          value={faceBoxWidth} 
                          onChange={(e) => setFaceBoxWidth(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-gray-500">ความสูง (Height)</span>
                          <span className="font-mono text-blue-600">{faceBoxHeight.toFixed(0)}%</span>
                        </div>
                        <input 
                          type="range" 
                          min="10" 
                          max="60" 
                          step="1" 
                          value={faceBoxHeight} 
                          onChange={(e) => setFaceBoxHeight(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-2 leading-tight">
                      * ปรับขนาดกรอบสีน้ำเงินให้พอดีกับอัตลักษณ์ตามความต้องการ
                    </p>
                  </div>
                </div>
              )}
              <p className="text-[10px] text-gray-400">
                * รายชื่อเหล่านี้จะถูกใช้เพื่อช่วยในการเดาชื่อจากหน้าจอให้แม่นยำขึ้น
              </p>
            </div>
          )}

          {/* Video Preview & Crop Box */}
          <div className="relative bg-black rounded-lg overflow-hidden flex items-center justify-center min-h-[180px] shrink-0 border border-gray-200 shadow-inner">
            {!stream && (
              <button 
                onClick={startCapture}
                className="flex flex-col items-center gap-3 p-8 w-full h-full hover:bg-gray-900 transition-all group"
              >
                <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center text-gray-500 group-hover:text-blue-500 group-hover:bg-gray-700 transition-all shadow-lg group-hover:scale-110">
                  <Plus size={40} />
                </div>
                <span className="text-gray-400 font-bold text-lg group-hover:text-gray-200">คลิกเพื่อเลือกหน้าจอ</span>
                <p className="text-gray-600 text-xs text-center max-w-xs">
                  คลิกที่นี่เพื่อเริ่มการอ่านชื่อผู้พูดจากหน้าจอวีดีโอ
                </p>
              </button>
            )}
            
            {stream && (
              <div className="relative inline-block max-w-full max-h-[40vh] group">
                <video 
                  ref={previewVideoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className="max-w-full max-h-[40vh] block"
                />
                
                {/* Add Speaker Button Overlay */}
                <button 
                  onClick={() => {
                    const category = (activeTab === 'senators' || activeTab === 'speakers') ? activeTab : 'senators';
                    if (rawText) {
                      setAddModal({ 
                        isOpen: true, 
                        name: formatSpeakerName(rawText),
                        category: category
                      });
                    } else {
                      setAddModal({ 
                        isOpen: true, 
                        name: '',
                        category: category
                      });
                    }
                  }}
                  className="absolute top-2 right-2 p-2 bg-blue-600/80 text-white rounded-full hover:bg-blue-600 transition-all opacity-0 group-hover:opacity-100 shadow-lg backdrop-blur-sm z-10"
                  title="เพิ่มรายชื่อใหม่"
                >
                  <Plus size={20} />
                </button>
                
                {/* Crop Box UI */}
                {enableOCR && (
                  <div 
                    className="absolute border-2 border-red-500 bg-red-500/20 cursor-move"
                    style={{
                      left: `${cropBox.x}%`,
                      top: `${cropBox.y}%`,
                      width: `${cropBox.width}%`,
                      height: `${cropBox.height}%`,
                    }}
                    onMouseDown={handleMouseDownMove}
                  >
                    <div className="absolute -top-6 left-0 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap font-bold shadow-sm">
                      กรอบอ่านชื่อ
                    </div>
                    {/* Resize Handle */}
                    <div 
                      className="absolute bottom-0 right-0 w-4 h-4 bg-red-500 cursor-se-resize rounded-tl-sm shadow-sm"
                      onMouseDown={handleMouseDownResize}
                    />
                  </div>
                )}
                
                {/* Face Box UI */}
                {faceBox && (
                  <div 
                    className="absolute border-2 transition-all duration-300 ease-out pointer-events-none"
                    style={{
                      left: `${faceBox.x}%`,
                      top: `${faceBox.y}%`,
                      width: `${faceBox.width}%`,
                      height: `${faceBox.height}%`,
                      borderColor: faceBox.color,
                      boxShadow: `0 0 10px ${faceBox.color}80`
                    }}
                  >
                    {faceBox.label && (
                      <div className="absolute -top-8 left-0 px-2 py-1 text-xs font-bold text-white rounded" style={{ backgroundColor: faceBox.color }}>
                        {faceBox.label}
                      </div>
                    )}
                    {faceBox.descriptor && (
                      <div className="absolute -bottom-10 left-0 flex gap-2 pointer-events-auto">
                        <button onClick={() => handleConfirm(faceBox.descriptor!)} className="bg-green-500 p-1 rounded text-white hover:bg-green-600">
                          <Check size={16} />
                        </button>
                        <button onClick={() => setFaceBox(null)} className="bg-red-500 p-1 rounded text-white hover:bg-red-600">
                          <X size={16} />
                        </button>
                      </div>
                    )}
                    
                    {isDebugMode && faceBox.debug && (
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[9px] px-2 py-1 rounded whitespace-nowrap font-mono shadow-md border border-white/20 backdrop-blur-sm">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex justify-between gap-3">
                            <span className="text-gray-400">Dist:</span>
                            <span className={faceBox.debug.distance < faceThreshold ? 'text-green-400' : 'text-red-400'}>
                              {faceBox.debug.distance.toFixed(3)}
                            </span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span className="text-gray-400">Pose:</span>
                            <span className={(faceBox.debug.pose.yaw > 35 || faceBox.debug.pose.pitch > 35) ? 'text-orange-400' : 'text-blue-400'}>
                              Y:{faceBox.debug.pose.yaw.toFixed(0)}° P:{faceBox.debug.pose.pitch.toFixed(0)}°
                            </span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span className="text-gray-400">Blur:</span>
                            <span className={faceBox.debug.blur < 100 ? 'text-orange-400' : 'text-green-400'}>
                              {faceBox.debug.blur.toFixed(1)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Crop Box Controls (Sliders for simplicity) */}
          {stream && (
            <div className="flex flex-col gap-2">
              <button 
                onClick={() => setIsManualCropOpen(!isManualCropOpen)}
                className="text-xs text-blue-600 hover:text-blue-800 underline self-start"
              >
                {isManualCropOpen ? 'ซ่อนการตั้งค่าตำแหน่งด้วยตัวเลข' : 'ตั้งค่าตำแหน่งด้วยตัวเลข (ขั้นสูง)'}
              </button>
              
              {isManualCropOpen && (
                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-3 rounded border border-gray-200 text-xs">
                  <div>
                    <label>ตำแหน่ง X: {cropBox.x}%</label>
                    <input type="range" min="0" max="100" value={cropBox.x} onChange={e => setCropBox({...cropBox, x: Number(e.target.value)})} className="w-full" />
                  </div>
                  <div>
                    <label>ตำแหน่ง Y: {cropBox.y}%</label>
                    <input type="range" min="0" max="100" value={cropBox.y} onChange={e => setCropBox({...cropBox, y: Number(e.target.value)})} className="w-full" />
                  </div>
                  <div>
                    <label>ความกว้าง: {cropBox.width}%</label>
                    <input type="range" min="5" max="100" value={cropBox.width} onChange={e => setCropBox({...cropBox, width: Number(e.target.value)})} className="w-full" />
                  </div>
                  <div>
                    <label>ความสูง: {cropBox.height}%</label>
                    <input type="range" min="5" max="100" value={cropBox.height} onChange={e => setCropBox({...cropBox, height: Number(e.target.value)})} className="w-full" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Hidden Canvas for OCR */}
          <canvas ref={canvasRef} className="hidden" />
        </div>

      {/* Predictions (Always visible when capturing) */}
      <div className="p-3 bg-gray-50 border-t border-gray-200 shrink-0">
        <div className="text-xs text-gray-500 mb-2 flex justify-between">
          <span>ผลการเดาชื่อ (คลิกเพื่อแทรก)</span>
          {isCapturing && (
            isProcessingOCR ? (
              <span className="text-blue-500 animate-pulse">กำลังอ่าน...</span>
            ) : (
              <span className="text-gray-500">ไม่ได้อ่านอยู่</span>
            )
          )}
        </div>
        
        <div className="min-h-[76px] flex flex-col justify-center">
          {predictions.length > 0 ? (
            <div className="flex flex-col gap-1">
            {/* Main Prediction */}
            <div className="flex gap-1">
              {editingPrediction === 0 ? (
                <div className="flex-1 flex gap-1">
                  <input 
                    type="text"
                    className="flex-1 px-3 py-2 border-2 border-blue-500 rounded text-sm outline-none"
                    value={editingPredictionValue}
                    onChange={(e) => setEditingPredictionValue(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onInsertSpeaker(formatSpeakerName(editingPredictionValue));
                        setEditingPrediction(null);
                      } else if (e.key === 'Escape') {
                        setEditingPrediction(null);
                      }
                    }}
                  />
                  <button 
                    onClick={() => {
                      onInsertSpeaker(formatSpeakerName(editingPredictionValue));
                      setEditingPrediction(null);
                    }}
                    className="px-3 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    <Check size={16} />
                  </button>
                  <button 
                    onClick={() => setEditingPrediction(null)}
                    className="px-3 bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex-1 flex gap-1">
                  <button
                    onClick={() => onInsertSpeaker(formatSpeakerName(predictions[0]))}
                    className="flex-1 text-left px-3 py-2 bg-white border border-blue-200 hover:bg-blue-50 rounded text-sm font-medium text-blue-800 shadow-sm transition-colors flex justify-between items-center group overflow-hidden"
                  >
                    <span className={`${isMinimized ? '' : 'truncate'} pr-2`} title={formatSpeakerName(predictions[0])}>{formatSpeakerName(predictions[0])}</span>
                    {(() => {
                      const formatted = formatSpeakerName(predictions[0]);
                      const isSenator = senatorList.some(s => formatSpeakerName(s) === formatted);
                      const isSpeaker = speakerList.some(s => formatSpeakerName(s) === formatted);
                      const hasFace = indexedFaces.includes(formatted);
                      
                      return (
                        <div className="flex gap-1 shrink-0">
                          {hasFace && !isMinimized && <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-100 text-purple-800 border border-purple-200 font-bold flex items-center gap-1"><ScanFace size={10}/> มีอัตลักษณ์</span>}
                          {isSenator && <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#800000] text-white font-bold">สมาชิกวุฒิสภา</span>}
                          {!isSenator && isSpeaker && <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-800 border border-blue-200 font-bold">ผู้อภิปราย</span>}
                          {!isSenator && !isSpeaker && <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-100 text-green-800 border border-green-200 font-bold">ใหม่</span>}
                        </div>
                      );
                    })()}
                  </button>
                  <button 
                    onClick={() => {
                      setEditingPrediction(0);
                      setEditingPredictionValue(formatSpeakerName(predictions[0]));
                    }}
                    className="px-3 bg-white border border-blue-200 hover:bg-blue-50 rounded text-blue-600 shadow-sm transition-all"
                    title="แก้ไขชื่อก่อนแทรก"
                  >
                    <Edit2 size={14} />
                  </button>
                </div>
              )}
              <button 
                onClick={() => {
                  const trimmed = predictions[0].trim();
                  if (trimmed) {
                    const category = (activeTab === 'senators' || activeTab === 'speakers') ? activeTab : 'senators';
                    setAddModal({
                      isOpen: true,
                      name: formatSpeakerName(trimmed),
                      category: category
                    });
                  }
                }}
                className="px-2 bg-white border border-blue-200 hover:bg-blue-50 rounded text-blue-600 shadow-sm transition-all"
                title={`เพิ่มลงในรายชื่อ...`}
              >
                <UserPlus size={16} />
              </button>
              
              {/* Face Registration Button */}
              {!isMinimized && (
              <button 
                onClick={async () => {
                  if (!previewVideoRef.current || !isFaceApiLoaded) return;
                  const targetName = formatSpeakerName(predictions[0]);
                  
                  setIsRegisteringFace(true);
                  // Allow UI to update before heavy computation
                  await new Promise(resolve => setTimeout(resolve, 100));
                  
                  try {
                    const detection = await extractCenterFace(previewVideoRef.current);
                    if (detection) {
                      const box = detection.detection.box;
                      
                      // Extract extra features
                      const clothingBox = {
                        x: box.x,
                        y: box.y + box.height,
                        width: box.width,
                        height: box.height * 1.5
                      };
                      const clothingGrid = extractColorGrid(previewVideoRef.current, clothingBox);
                      
                      const headBox = {
                        x: box.x,
                        y: box.y - box.height * 0.5,
                        width: box.width,
                        height: box.height * 0.5
                      };
                      const headGrid = extractColorGrid(previewVideoRef.current, headBox);
                      
                      const position = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
                      
                      saveFaceToDB(targetName, detection.descriptor, 'faceDB', { clothingGrid, headGrid, position });
                      refreshIndexedFaces();
                      
                      const vw = previewVideoRef.current.videoWidth;
                      const vh = previewVideoRef.current.videoHeight;
                      setFaceBox({
                        x: (box.x / vw) * 100,
                        y: (box.y / vh) * 100,
                        width: (box.width / vw) * 100,
                        height: (box.height / vh) * 100,
                        label: 'บันทึกสำเร็จ!',
                        color: '#a855f7' // purple
                      });
                      setTimeout(() => setFaceBox(null), 2000);
                      
                      setToast({ show: true, msg: `บันทึกอัตลักษณ์ ${targetName} สำเร็จ!`, type: 'success' });
                    } else {
                      setToast({ show: true, msg: `ไม่พบอัตลักษณ์ในวิดีโอ กรุณาลองใหม่`, type: 'error' });
                    }
                  } catch (err) {
                    setToast({ show: true, msg: `เกิดข้อผิดพลาดในการบันทึกอัตลักษณ์`, type: 'error' });
                  } finally {
                    setIsRegisteringFace(false);
                    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
                  }
                }}
                disabled={isRegisteringFace || !isFaceApiLoaded}
                className={`px-3 flex items-center gap-1 bg-white border ${isRegisteringFace ? 'border-purple-300 text-purple-400 bg-purple-50' : 'border-purple-200 hover:bg-purple-50 text-purple-600'} rounded shadow-sm transition-all`}
                title={isFaceApiLoaded ? `บันทึกอัตลักษณ์ ${formatSpeakerName(predictions[0])} ลงดัชนี` : 'กำลังโหลดโมเดลอัตลักษณ์...'}
              >
                {isRegisteringFace ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span className="text-xs font-bold">กำลังบันทึก...</span>
                  </>
                ) : (
                  <>
                    <Camera size={16} />
                    <span className="text-xs font-bold">จำอัตลักษณ์</span>
                  </>
                )}
              </button>
              )}
            </div>

            {/* Alternative Predictions (Pills) - Fixed height to prevent layout shift */}
            <div className="flex flex-wrap gap-1 mt-1 min-h-[24px]">
              {predictions.length > 1 && predictions.slice(1).map((speaker, idx) => (
                <button
                  key={idx}
                  onClick={() => onInsertSpeaker(formatSpeakerName(speaker))}
                  className="px-2 py-0.5 bg-white border border-gray-200 hover:bg-blue-50 hover:border-blue-200 rounded text-[10px] font-medium text-gray-500 hover:text-blue-700 shadow-sm transition-all whitespace-nowrap"
                >
                  {formatSpeakerName(speaker)}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-400 text-center py-2">
            {isCapturing ? 'ไม่พบรายชื่อที่ตรงกัน' : 'รอการอ่านหน้าจอ...'}
          </div>
        )}
      </div>
        
        {/* Debug Raw Text */}
        {isCapturing && rawText && (
          <div className="mt-2 text-[10px] text-gray-400 truncate" title={rawText}>
            อ่านได้: {rawText}
          </div>
        )}
      </div>
    </div>

    {/* Confirm Dialog Modal */}
    {confirmDialog.show && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
          <h3 className="text-lg font-bold text-gray-900 mb-2">ยืนยันการดำเนินการ</h3>
          <p className="text-sm text-gray-600 mb-6">{confirmDialog.message}</p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setConfirmDialog({ show: false, message: '', onConfirm: () => {} })}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            >
              ยกเลิก
            </button>
            <button
              onClick={() => {
                confirmDialog.onConfirm();
                setConfirmDialog({ show: false, message: '', onConfirm: () => {} });
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
            >
              ยืนยัน
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};
