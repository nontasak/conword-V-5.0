import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, Scissors, Save, X, Edit2, Trash2, Video, VideoOff, Maximize2, Minimize2, Volume2, VolumeX, Mic, MicOff, Download, Settings, Type, Eraser, Plus, Minus, AlertCircle, BrainCircuit } from 'lucide-react';
import Cropper from 'react-easy-crop';
import { motion, AnimatePresence } from 'motion/react';
import * as faceapi from '@vladmandic/face-api';
import { Recorder } from 'vmsg';
import { 
  extractCenterFace, 
  saveFaceToDB, 
  recognizeFace, 
  getFaceDB,
  loadFaceModels
} from '../services/faceService';

interface CommitteeMember {
  id: string;
  name: string;
  position: string;
  image: string; // Base64 cropped image
  faceDescriptor?: number[];
  imageSignature?: number[]; // For fast visual matching
  cropArea?: { x: number, y: number, width: number, height: number }; // For region-specific matching
}

const computeColorHistogram = (source: CanvasImageSource, cropArea?: {x: number, y: number, width: number, height: number}): number[] => {
  const canvas = document.createElement('canvas');
  const size = 64;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];
  
  if (cropArea) {
    ctx.drawImage(source, cropArea.x, cropArea.y, cropArea.width, cropArea.height, 0, 0, size, size);
  } else {
    ctx.drawImage(source, 0, 0, size, size);
  }
  
  const imageData = ctx.getImageData(0, 0, size, size).data;
  
  const bins = 8;
  const histogram = new Array(bins * bins * bins).fill(0);
  
  for (let i = 0; i < imageData.length; i += 4) {
    const r = Math.floor((imageData[i] / 256) * bins);
    const g = Math.floor((imageData[i+1] / 256) * bins);
    const b = Math.floor((imageData[i+2] / 256) * bins);
    const index = (r * bins * bins) + (g * bins) + b;
    if (index >= 0 && index < histogram.length) {
      histogram[index]++;
    }
  }
  
  const total = size * size;
  return histogram.map(count => count / total);
};

const compareHistograms = (hist1: number[], hist2: number[]): number => {
  if (!hist1 || !hist2 || hist1.length === 0 || hist1.length !== hist2.length) return 0;
  let intersection = 0;
  for (let i = 0; i < hist1.length; i++) {
    intersection += Math.min(hist1[i], hist2[i]);
  }
  return intersection * 100;
};

interface CommitteeIdentifierProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertText?: (text: string) => void;
}

const AudioVisualizer: React.FC<{ stream: MediaStream | null }> = ({ stream }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    if (!stream || !canvasRef.current) return;

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const draw = () => {
      if (!ctx) return;
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * canvas.height;
        ctx.fillStyle = `rgb(59, 130, 246)`; // blue-500
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      audioContext.close();
    };
  }, [stream]);

  return <canvas ref={canvasRef} width={100} height={20} className="rounded opacity-80" />;
};

export const CommitteeIdentifier: React.FC<CommitteeIdentifierProps> = ({ isOpen, onClose, onInsertText }) => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [members, setMembers] = useState<CommitteeMember[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [similarity, setSimilarity] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [cardScale, setCardScale] = useState(0.7);
  const [videoZoom, setVideoZoom] = useState(1);
  const [videoPan, setVideoPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [audioGain, setAudioGain] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const recorderRef = useRef<Recorder | null>(null);
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const timerRef = useRef<any>(null);
  
  const [visualizerStream, setVisualizerStream] = useState<MediaStream | null>(null);

  // Feature Toggle
  const [enableFaceRec, setEnableFaceRec] = useState(true);

  // Load models on mount
  useEffect(() => {
    const init = async () => {
      try {
        await loadFaceModels();
        setModelsLoaded(true);
      } catch (e) {
        console.error("Failed to load face models", e);
      }
    };
    init();
  }, []);

  // Load members from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('committee_members');
    if (saved) {
      try {
        setMembers(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load members", e);
      }
    }
  }, []);

  // Persist members
  useEffect(() => {
    localStorage.setItem('committee_members', JSON.stringify(members));
  }, [members]);

  // Load audio devices
  useEffect(() => {
    recorderRef.current = new Recorder({
      wasmURL: 'https://unpkg.com/vmsg@0.4.0/vmsg.wasm'
    });
  }, []);

  const startStream = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" } as any,
        audio: true // Enable system audio capture
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.volume = volume;
        videoRef.current.muted = isMuted;
      }
    } catch (err) {
      console.error("Error starting screen share:", err);
    }
  };

  const stopStream = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const toggleFaceRecognition = () => {
    setEnableFaceRec(prev => !prev);
  };

  const captureFrame = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        setCapturedImage(canvas.toDataURL('image/jpeg'));
        setIsCapturing(true);
      }
    }
  };

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const getCroppedImg = async (imageSrc: string, pixelCrop: any): Promise<string> => {
    const image = new Image();
    image.src = imageSrc;
    await new Promise(resolve => image.onload = resolve);

    const canvas = document.createElement('canvas');
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) return '';

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return canvas.toDataURL('image/jpeg');
  };

  const handleSave = async () => {
    if (!capturedImage || !croppedAreaPixels || !name) return;

    setIsSaving(true);
    try {
      const croppedImg = await getCroppedImg(capturedImage, croppedAreaPixels);
      
      const tempImg = document.createElement('img');
      tempImg.src = croppedImg;
      await new Promise(resolve => tempImg.onload = resolve);

      let faceData: any = null;
      let imageSignature: number[] = [];

      if (enableFaceRec) {
        // Make a single attempt on the high-quality cropped thumbnail
        faceData = await extractCenterFace(tempImg as any, false, true, null, true, false);
      
        // Fallback: If no face found in captured image, try to detect from the live video stream
        if ((!faceData || !faceData.descriptor) && videoRef.current && stream) {
          console.log("Face not found in capture, trying live video fallback...");
          faceData = await extractCenterFace(videoRef.current, false, true, null, true, false);
        }

        // Compute image signature (color histogram) of the CROPPED frame for fast visual matching
        const imgForHist = new Image();
        imgForHist.src = croppedImg;
        await new Promise(resolve => imgForHist.onload = resolve);
        imageSignature = computeColorHistogram(imgForHist);
      }

      if (faceData && faceData.descriptor) {
        // Save to faceDB for recognition
        saveFaceToDB(name, faceData.descriptor, 'committee_face_db');
        
        const newMember: CommitteeMember = {
          id: Date.now().toString(),
          name,
          position,
          image: croppedImg,
          faceDescriptor: Array.from(faceData.descriptor),
          imageSignature,
          cropArea: croppedAreaPixels
        };
        
        setMembers(prev => [...prev, newMember]);
        setIsCapturing(false);
        setCapturedImage(null);
        setName('');
        setPosition('');
      } else {
        // Automatically save without confirmation if no face found
        const newMember: CommitteeMember = {
          id: Date.now().toString(),
          name,
          position,
          image: croppedImg,
          faceDescriptor: undefined,
          imageSignature,
          cropArea: croppedAreaPixels
        };
        
        setMembers(prev => [...prev, newMember]);
        setIsCapturing(false);
        setCapturedImage(null);
        setName('');
        setPosition('');
        // Brief notification instead of alert
        console.log("บันทึกข้อมูลแล้ว (ไม่พบใบหน้า)");
      }
    } catch (err) {
      console.error("Error saving member:", err);
      alert("เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setIsSaving(false);
    }
  };

  const handleVideoMouseDown = (e: React.MouseEvent) => {
    if (videoZoom > 1) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - videoPan.x, y: e.clientY - videoPan.y });
    }
  };

  const handleVideoMouseMove = (e: React.MouseEvent) => {
    if (isPanning && videoZoom > 1) {
      // Prevent default to avoid text selection or other browser behaviors
      e.preventDefault();
      
      setVideoPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  };

  const handleVideoMouseUp = () => {
    setIsPanning(false);
  };

  // Recognition Loop
  useEffect(() => {
    if (!enableFaceRec || !stream || !modelsLoaded || members.length === 0 || isCapturing) {
      if (!enableFaceRec) {
        setHighlightedId(null);
        setSimilarity(null);
      }
      return;
    }

    let active = true;
    const faceDB = getFaceDB('committee_face_db');

    const loop = async () => {
      if (!active || !videoRef.current) return;

      try {
        let bestMatchId: string | null = null;
        let highestSimilarity = 0;

        // 1. Try Face Recognition first
        const match = await recognizeFace(videoRef.current, faceDB, 0.5, false, null, false, false, false);
        
        if (match && match.match) {
          const member = members.find(m => m.name === match.match);
          if (member) {
            bestMatchId = member.id;
            highestSimilarity = Math.max(0, Math.min(100, (1 - match.distance) * 100));
          }
        }

        // 2. Fast Visual Matching Fallback (Region-based Color Histogram)
        // If face recognition fails or confidence is low, try matching the specific cropped region
        if (highestSimilarity < 60) {
          members.forEach(member => {
            if (member.imageSignature && member.cropArea) {
              const currentSignature = computeColorHistogram(videoRef.current, member.cropArea);
              if (currentSignature.length > 0) {
                const sim = compareHistograms(currentSignature, member.imageSignature);
                // Threshold of 85% for region matching
                if (sim > highestSimilarity && sim > 85) {
                  highestSimilarity = sim;
                  bestMatchId = member.id;
                }
              }
            }
          });
        }

        setHighlightedId(bestMatchId);
        setSimilarity(highestSimilarity > 0 ? Math.round(highestSimilarity) : null);

      } catch (e) {
        // Silent fail for loop
      }

      if (active) {
        setTimeout(loop, 1000); // Run every second to save CPU
      }
    };

    loop();
    return () => { active = false; };
  }, [stream, modelsLoaded, members, isCapturing]);

  const deleteMember = (id: string, name: string) => {
    if (window.confirm(`ยืนยันการลบ ${name}?`)) {
      setMembers(prev => prev.filter(m => m.id !== id));
      // Also remove from faceDB if possible (optional, but good practice)
      // deleteFaceFromDB(name, 'committee_face_db');
    }
  };

  const updateMember = (id: string, newName: string, newPos: string) => {
    setMembers(prev => prev.map(m => m.id === id ? { ...m, name: newName, position: newPos } : m));
    setIsEditing(null);
  };

  const startRecording = async () => {
    try {
      if (!recorderRef.current) {
        recorderRef.current = new Recorder({
          wasmURL: 'https://unpkg.com/vmsg@0.4.0/vmsg.wasm'
        });
      }

      // Initialize and start the recorder with gain control
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const userStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const source = audioContext.createMediaStreamSource(userStream);
      const gainNode = audioContext.createGain();
      gainNode.gain.value = audioGain;
      
      const destination = audioContext.createMediaStreamDestination();
      source.connect(gainNode);
      gainNode.connect(destination);
      
      // Use the stream with gain applied
      await (recorderRef.current as any).init(); // vmsg init usually doesn't take the stream directly here, it uses the context
      recorderRef.current.startRecording();
      
      setVisualizerStream(destination.stream);

      setIsRecording(true);
      setRecordingTime(0);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Error starting recording:", err);
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        alert("ไม่สามารถเริ่มการอัดเสียงได้: กรุณาอนุญาตการเข้าถึงไมโครโฟนในเบราว์เซอร์");
      } else if (err instanceof DOMException && err.name === 'NotFoundError') {
        alert("ไม่สามารถเริ่มการอัดเสียงได้: ไม่พบอุปกรณ์ไมโครโฟน");
      } else {
        alert("ไม่สามารถเริ่มการอัดเสียงได้: " + (err instanceof Error ? err.message : String(err)));
      }
    }
  };

  const stopRecording = async () => {
    if (!isRecording || !recorderRef.current || isProcessingAudio) return;

    // Clear timer immediately to stop UI update
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setIsProcessingAudio(true);

    try {
      // For long recordings (e.g., 30 mins), encoding MP3 can take a significant amount of time.
      // We remove the short 15-second timeout and let the encoder finish its job.
      // We can add a very long fallback timeout (e.g., 5 minutes) just in case the WASM module hangs completely.
      const stopPromise = recorderRef.current.stopRecording();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Timeout stopping recording")), 300000) // 5 minutes timeout
      );

      const blob = await Promise.race([stopPromise, timeoutPromise]) as Blob;
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recording-${new Date().toISOString()}.mp3`;
      a.click();
      
      // Memory Management: Revoke URL after download
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);

      // Stop visualizer stream
      if (visualizerStream) {
        visualizerStream.getTracks().forEach(track => track.stop());
        setVisualizerStream(null);
      }

      setIsRecording(false);
      // Reset recorder for next use to clear memory
      recorderRef.current = null;
    } catch (err) {
      console.error("Error stopping recording:", err);
      alert("เกิดข้อผิดพลาดในการบันทึกไฟล์เสียง (อาจเป็นเพราะไฟล์มีขนาดใหญ่เกินไป หรือระบบขัดข้อง)");
      setIsRecording(false);
      if (visualizerStream) {
        visualizerStream.getTracks().forEach(track => track.stop());
        setVisualizerStream(null);
      }
      recorderRef.current = null;
    } finally {
      setIsProcessingAudio(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const clearAllData = () => {
    if (window.confirm("คุณต้องการล้างข้อมูลกรรมาธิการทั้งหมดใช่หรือไม่? (ฐานข้อมูลใบหน้าจะถูกลบด้วย)")) {
      setMembers([]);
      localStorage.removeItem('committee_members');
      localStorage.removeItem('committee_face_db');
      alert("ล้างข้อมูลเรียบร้อยแล้ว");
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="committee-identifier-panel flex flex-col h-full bg-[#f8f8f8] border-l border-gray-300 shadow-2xl overflow-hidden transition-all duration-300"
      style={{ width: isExpanded ? '600px' : '300px' }}
    >
      <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white">
        <h2 className="text-lg font-bold text-[#0b3955] flex items-center gap-2">
          <Video className="w-5 h-5" />
          ระบุชื่อกรรมาธิการ
        </h2>
        <div className="flex items-center gap-2">
          <button 
            onClick={toggleFaceRecognition}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors border ${enableFaceRec ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}
            title={enableFaceRec ? 'ปิดระบบสแกนใบหน้า AI' : 'เปิดระบบสแกนใบหน้า AI'}
          >
            <BrainCircuit className="w-3.5 h-3.5" />
            {enableFaceRec ? 'AI ทำงาน' : 'AI ปิดอยู่'}
          </button>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Video Section */}
        <div className={`relative bg-black rounded-lg overflow-hidden shadow-inner group transition-all duration-300 ${isExpanded ? 'aspect-[21/9]' : 'aspect-video'}`}>
          <div 
            className={`w-full h-full overflow-hidden flex items-center justify-center ${videoZoom > 1 ? 'cursor-move' : ''}`}
            onMouseDown={handleVideoMouseDown}
            onMouseMove={handleVideoMouseMove}
            onMouseUp={handleVideoMouseUp}
            onMouseLeave={handleVideoMouseUp}
          >
            <video 
              ref={videoRef} 
              autoPlay 
              muted={isMuted}
              playsInline 
              className="w-full h-full object-contain transition-transform duration-200 pointer-events-none"
              style={{ 
                transform: `scale(${videoZoom}) translate(${videoPan.x / videoZoom}px, ${videoPan.y / videoZoom}px)` 
              }}
            />
          </div>
          
          {/* Zoom Controls Overlay */}
          <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={() => setVideoZoom(prev => Math.min(5, prev + 0.5))}
              className="p-1.5 bg-black/50 text-white rounded hover:bg-black/70 transition-colors"
              title="ซูมเข้า"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button 
              onClick={() => {
                setVideoZoom(1);
                setVideoPan({ x: 0, y: 0 });
              }}
              className="p-1.5 bg-black/50 text-white rounded hover:bg-black/70 transition-colors"
              title="รีเซ็ตซูม"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
            <button 
              onClick={() => {
                const newZoom = Math.max(1, videoZoom - 0.5);
                setVideoZoom(newZoom);
                if (newZoom === 1) setVideoPan({ x: 0, y: 0 });
              }}
              className="p-1.5 bg-black/50 text-white rounded hover:bg-black/70 transition-colors"
              title="ซูมออก"
            >
              <Minus className="w-4 h-4" />
            </button>
          </div>

          {/* Audio Controls Overlay */}
          {stream && (
            <div className="absolute top-2 left-2 flex items-center gap-2 bg-black/50 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => {
                  setIsMuted(!isMuted);
                  if (videoRef.current) videoRef.current.muted = !isMuted;
                }}
                className="text-white hover:text-blue-400 transition-colors"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.1" 
                value={volume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setVolume(val);
                  if (videoRef.current) videoRef.current.volume = val;
                }}
                className="w-16 h-1 bg-gray-400 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>
          )}
          {!stream && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-2">
              <VideoOff className="w-10 h-10 opacity-20" />
              <p className="text-xs">ยังไม่ได้เริ่มสตรีม</p>
            </div>
          )}
          
          <div className="absolute bottom-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 bg-gray-800/80 text-white rounded-full shadow-lg hover:bg-gray-700 transition-colors"
              title={isExpanded ? "ย่อหน้าจอ" : "ขยายหน้าจอ"}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {!stream ? (
              <button 
                onClick={startStream}
                className="p-2 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors"
                title="เริ่มสตรีม (แชร์หน้าจอ)"
              >
                <Video className="w-4 h-4" />
              </button>
            ) : (
              <>
                <button 
                  onClick={captureFrame}
                  className="p-2 bg-green-600 text-white rounded-full shadow-lg hover:bg-green-700 transition-colors"
                  title="แคปเจอร์"
                >
                  <Camera className="w-4 h-4" />
                </button>
                <button 
                  onClick={stopStream}
                  className="p-2 bg-red-600 text-white rounded-full shadow-lg hover:bg-red-700 transition-colors"
                  title="หยุดสตรีม"
                >
                  <VideoOff className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Audio Recording Section - Single Line UI */}
        <div className="bg-white p-2 rounded-xl shadow-md border border-gray-100 mx-1 space-y-2">
          <div className="flex items-center gap-2 overflow-hidden">
            <button 
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isProcessingAudio}
              className={`p-2 rounded-lg transition-all active:scale-90 flex-shrink-0 ${
                isProcessingAudio ? 'bg-gray-400 text-white cursor-not-allowed' :
                isRecording 
                  ? 'bg-red-500 text-white animate-pulse' 
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
              title={isProcessingAudio ? "กำลังประมวลผล..." : isRecording ? "หยุดและบันทึก MP3" : "เริ่มอัดเสียง"}
            >
              {isProcessingAudio ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : isRecording ? (
                <MicOff className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>

            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-gray-500 font-medium truncate">
                {isProcessingAudio ? "กำลังประมวลผลไฟล์ MP3 (อาจใช้เวลาสักครู่)..." : isRecording ? "กำลังบันทึกเสียง..." : "พร้อมบันทึกเสียง"}
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <Volume2 className="w-3 h-3 text-gray-400" />
                <input 
                  type="range" 
                  min="0" 
                  max="2" 
                  step="0.1" 
                  value={audioGain}
                  onChange={(e) => setAudioGain(parseFloat(e.target.value))}
                  className="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  title="ปรับความดังเสียงขาเข้า"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0 pr-1">
              <AudioVisualizer stream={visualizerStream} />
              <span className={`text-[10px] font-mono font-bold ${isRecording ? 'text-red-500' : 'text-gray-400'}`}>
                {formatTime(recordingTime)}
              </span>
            </div>
          </div>
        </div>

        {/* Capture/Crop UI - Floating to the left of the screen */}
        <AnimatePresence>
          {isCapturing && (
            <motion.div 
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              className="fixed top-20 z-[100] bg-white/90 backdrop-blur-md p-4 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-white/20 w-[340px] space-y-4"
              style={{ right: isExpanded ? '620px' : '320px' }}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight">ครอปภาพและระบุชื่อ</h3>
                </div>
                <button 
                  onClick={() => setIsCapturing(false)} 
                  className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-full transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="relative h-56 bg-gray-100 rounded-xl overflow-hidden shadow-inner">
                <Cropper
                  image={capturedImage!}
                  crop={crop}
                  zoom={zoom}
                  aspect={4 / 3}
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                />
              </div>
              
              <div className="space-y-3">
                <div className="space-y-2">
                  <input 
                    type="text" 
                    placeholder="ชื่อ-นามสกุล"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                  />
                  <input 
                    type="text" 
                    placeholder="ตำแหน่ง"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    className="w-full p-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                  />
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={handleSave}
                    disabled={!name || isSaving}
                    className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-200 transition-all active:scale-95"
                  >
                    {isSaving ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Members List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              รายชื่อที่บันทึกไว้ ({members.length})
            </h3>
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-gray-100 rounded-lg px-1 gap-1">
                <button 
                  onClick={() => setCardScale(prev => Math.max(0.5, prev - 0.1))}
                  className="p-1 text-gray-500 hover:text-blue-600"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="text-[9px] font-bold text-gray-400 w-8 text-center">
                  {Math.round(cardScale * 100)}%
                </span>
                <button 
                  onClick={() => setCardScale(prev => Math.min(1.5, prev + 0.1))}
                  className="p-1 text-gray-500 hover:text-blue-600"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              {members.length > 0 && (
                <button 
                  onClick={clearAllData}
                  className="text-[10px] text-red-400 hover:text-red-600 flex items-center gap-1 transition-colors"
                >
                  <Eraser className="w-3 h-3" /> ล้างข้อมูล
                </button>
              )}
            </div>
          </div>
          
          {members.length === 0 && !isCapturing && (
            <div className="text-center py-8 text-gray-400 italic text-xs bg-white/50 rounded-xl border border-dashed border-gray-200">
              ยังไม่มีรายชื่อกรรมาธิการ
            </div>
          )}

          <div 
            className="grid gap-3"
            style={{ 
              gridTemplateColumns: `repeat(auto-fill, minmax(${Math.max(60, 140 * cardScale)}px, 1fr))`,
            }}
          >
            {members.map(member => (
              <motion.div 
                key={member.id}
                layout
                className={`group relative bg-white p-2 rounded-xl border transition-all ${
                  highlightedId === member.id 
                    ? 'border-blue-500 shadow-md ring-1 ring-blue-200' 
                    : 'border-gray-100 shadow-sm hover:border-gray-200'
                }`}
              >
                <div className="flex flex-col gap-2">
                  <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-50 border border-gray-100">
                    <img src={member.image} alt={member.name} className="w-full h-full object-cover" />
                    {/* Recognition Indicator */}
                    {highlightedId === member.id && similarity && (
                      <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-blue-600 text-white text-[8px] font-bold rounded-md shadow-lg z-10">
                        {similarity}%
                      </div>
                    )}
                  </div>
                  
                  <div className="min-width-0">
                    {isEditing === member.id ? (
                      <div className="space-y-1">
                        <input 
                          autoFocus
                          className="w-full text-[10px] p-1 border rounded"
                          defaultValue={member.name}
                          onBlur={(e) => updateMember(member.id, e.target.value, member.position)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') updateMember(member.id, (e.target as HTMLInputElement).value, member.position);
                          }}
                        />
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        <h4 className="text-[11px] font-bold text-gray-800 truncate flex items-center gap-1">
                          <button 
                            onClick={() => onInsertText?.(`\n\t\t${member.name}   :   `)}
                            className="p-0.5 bg-blue-600 rounded text-white hover:bg-blue-700 flex-shrink-0 transition-all active:scale-90"
                            title="ใส่ชื่อ (ย่อหน้า 2 แท็บ)"
                          >
                            <Plus className="w-2.5 h-2.5" />
                          </button>
                          <span className="truncate">{member.name}</span>
                          {!member.faceDescriptor && (
                            <span title="ไม่สามารถจดจำใบหน้าได้" className="text-amber-500">
                              <AlertCircle className="w-2.5 h-2.5" />
                            </span>
                          )}
                        </h4>
                        <p className="text-[9px] text-gray-400 truncate pl-4">{member.position}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="absolute top-1 right-1 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => setIsEditing(member.id)}
                    className="p-1 bg-white/90 backdrop-blur shadow rounded-md text-gray-400 hover:text-blue-600"
                  >
                    <Edit2 className="w-2.5 h-2.5" />
                  </button>
                  <button 
                    onClick={() => deleteMember(member.id, member.name)}
                    className="p-1 bg-white/90 backdrop-blur shadow rounded-md text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
