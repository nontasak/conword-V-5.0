import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, X, Save, Edit2, Play, Square, Users, Volume2, Settings, History, RefreshCw, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SpeakerProfile {
  id: string;
  name: string;
  spectralSignature: number[];
  color: string;
}

interface VoiceSpeakerManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertText: (text: string) => void;
  onRenameSpeaker: (oldName: string, newName: string) => void;
}

const COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', 
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1'
];

export const VoiceSpeakerManager: React.FC<VoiceSpeakerManagerProps> = ({ 
  isOpen, 
  onClose, 
  onInsertText,
  onRenameSpeaker
}) => {
  const [isListening, setIsListening] = useState(false);
  const [profiles, setProfiles] = useState<SpeakerProfile[]>([]);
  const [currentSpeakerId, setCurrentSpeakerId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [sensitivity, setSensitivity] = useState(10);
  const [gain, setGain] = useState(1.0);
  const [showSettings, setShowSettings] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const recognitionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const profilesRef = useRef<SpeakerProfile[]>([]);
  const currentSpeakerRef = useRef<string | null>(null);
  const speakerChangeTimeoutRef = useRef<number | null>(null);
  const audioDataRef = useRef<Uint8Array | null>(null);
  const processingRef = useRef(false);
  
  // Last 3 seconds of spectrum data for current speaker detection
  const spectrumWindowRef = useRef<number[][]>([]);
  const MAX_WINDOW_SIZE = 15; // Roughly 1.5 seconds at 100ms intervals

  useEffect(() => {
    profilesRef.current = profiles;
  }, [profiles]);

  useEffect(() => {
    // Load profiles from local storage
    const saved = localStorage.getItem('voice_profiles');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setProfiles(parsed);
      } catch (e) {
        console.error("Failed to load voice profiles", e);
      }
    }
    
    return () => {
      stopListening();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('voice_profiles', JSON.stringify(profiles));
  }, [profiles]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawVisualizer = () => {
    if (!analyserRef.current || !audioDataRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    analyserRef.current.getByteFrequencyData(audioDataRef.current);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const barWidth = (canvas.width / audioDataRef.current.length) * 2;
    let x = 0;

    for (let i = 0; i < audioDataRef.current.length; i++) {
      const barHeight = (audioDataRef.current[i] / 255) * canvas.height;
      
      // Color gradient based on current speaker
      const speakerColor = currentSpeakerId ? profiles.find(p => p.id === currentSpeakerId)?.color || '#3b82f6' : '#9ca3af';
      ctx.fillStyle = speakerColor;
      ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
      x += barWidth + 1;
    }
  };

  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      
      // Add a dynamics compressor for normalization
      const compressor = audioContext.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-50, audioContext.currentTime);
      compressor.knee.setValueAtTime(40, audioContext.currentTime);
      compressor.ratio.setValueAtTime(12, audioContext.currentTime);
      compressor.attack.setValueAtTime(0, audioContext.currentTime);
      compressor.release.setValueAtTime(0.25, audioContext.currentTime);
      
      const gainNode = audioContext.createGain();
      gainNode.gain.setValueAtTime(gain, audioContext.currentTime);

      microphone.connect(gainNode);
      gainNode.connect(compressor);
      compressor.connect(analyser);
      
      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      microphoneRef.current = microphone;
      audioDataRef.current = dataArray;
      
      setIsListening(true);
      
      // Start processing loop
      processingRef.current = true;
      processAudio();
      
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("กรุณาอนุญาตการเข้าถึงไมโครโฟน");
    }
  };

  const stopListening = () => {
    setIsListening(false);
    processingRef.current = false;
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    
    setCurrentSpeakerId(null);
    currentSpeakerRef.current = null;
  };

  const processAudio = () => {
    if (!processingRef.current || !analyserRef.current || !audioDataRef.current) return;
    
    analyserRef.current.getByteFrequencyData(audioDataRef.current);
    
    // Check if there's enough volume (voice activity)
    const average = audioDataRef.current.reduce((a, b) => a + b) / audioDataRef.current.length;
    
    if (average > sensitivity) { // Voice detected
      const currentSpectrum = Array.from(audioDataRef.current).map(v => v / 255);
      spectrumWindowRef.current.push(currentSpectrum);
      if (spectrumWindowRef.current.length > MAX_WINDOW_SIZE) {
        spectrumWindowRef.current.shift();
      }
      
      if (spectrumWindowRef.current.length === MAX_WINDOW_SIZE) {
        const meanSpectrum = computeMeanSpectrum(spectrumWindowRef.current);
        identifySpeaker(meanSpectrum);
      }
    } else {
      // Silence: clear window slowly?
      if (spectrumWindowRef.current.length > 0) {
        spectrumWindowRef.current.shift();
      }
    }
    
    drawVisualizer();
    requestAnimationFrame(processAudio);
  };

  const computeMeanSpectrum = (window: number[][]) => {
    const size = window[0].length;
    const mean = new Array(size).fill(0);
    for (const spectrum of window) {
      for (let i = 0; i < size; i++) {
        mean[i] += spectrum[i];
      }
    }
    return mean.map(v => v / window.length);
  };

  const identifySpeaker = (spectrum: number[]) => {
    let bestMatch: string | null = null;
    let minDistance = 0.5; // Threshold for identification
    
    for (const profile of profilesRef.current) {
      const dist = euclideanDistance(spectrum, profile.spectralSignature);
      if (dist < minDistance) {
        minDistance = dist;
        bestMatch = profile.id;
      }
    }
    
    if (bestMatch) {
      handleSpeakerChange(bestMatch, spectrum);
    } else {
      // Unknown speaker
      handleSpeakerChange('unknown', spectrum);
    }
  };

  const handleSpeakerChange = (speakerId: string, spectrum: number[]) => {
    // Current recognized speaker differs from the "detected" one
    if (speakerId !== currentSpeakerRef.current) {
      // Debounce: must be different for a short time
      if (speakerChangeTimeoutRef.current) {
        // Already waiting to change?
        return;
      }
      
      speakerChangeTimeoutRef.current = window.setTimeout(() => {
        speakerChangeTimeoutRef.current = null;
        
        let finalId = speakerId;
        
        if (speakerId === 'unknown') {
          // Create a new profile
          const newId = `speaker-${Date.now()}`;
          const newProfile: SpeakerProfile = {
            id: newId,
            name: `ผู้พูด ${profilesRef.current.length + 1}`,
            spectralSignature: spectrum,
            color: COLORS[profilesRef.current.length % COLORS.length]
          };
          setProfiles(prev => [...prev, newProfile]);
          finalId = newId;
        }
        
        setCurrentSpeakerId(finalId);
        currentSpeakerRef.current = finalId;
        
        // Trigger Name & Initial Phrase Logger
        const profile = profilesRef.current.find(p => p.id === finalId);
        if (profile) {
          logInitialPhrase(profile.name);
        }
      }, 500); // 500ms debounce as requested
    }
  };

  const logInitialPhrase = (name: string) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    
    const recognition = new SpeechRecognition();
    recognition.lang = 'th-TH';
    recognition.continuous = false;
    recognition.interimResults = true;
    
    let phraseRecorded = false;
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (event.results[0].isFinal && !phraseRecorded) {
        phraseRecorded = true;
        // Insert name and phrase
        onInsertText(`\n\n\t\t${name}   :   ${transcript}`);
        recognition.stop();
      }
    };
    
    // Auto stop after 3 seconds even if not final
    const timeout = setTimeout(() => {
      if (!phraseRecorded) {
        recognition.stop();
      }
    }, 3000);
    
    recognition.onend = () => {
      clearTimeout(timeout);
    };
    
    recognition.start();
    recognitionRef.current = recognition;
  };

  const euclideanDistance = (a: number[], b: number[]) => {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      sum += Math.pow(a[i] - b[i], 2);
    }
    return Math.sqrt(sum);
  };

  const handleRename = () => {
    if (!editingId || !editingName.trim()) return;
    
    const profile = profiles.find(p => p.id === editingId);
    if (profile) {
      const oldName = profile.name;
      const newName = editingName.trim();
      
      setProfiles(prev => prev.map(p => p.id === editingId ? { ...p, name: newName } : p));
      onRenameSpeaker(oldName, newName);
    }
    
    setEditingId(null);
    setEditingName('');
  };

  const deleteProfile = (id: string) => {
    if (window.confirm("ลบโปรไฟล์เสียงนี้?")) {
      setProfiles(prev => prev.filter(p => p.id !== id));
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        style={{
          position: 'fixed',
          top: '80px',
          right: '20px',
          width: '320px',
          maxHeight: 'calc(100vh - 120px)',
          backgroundColor: 'white',
          borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          border: '1px solid #e5e7eb',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <div style={{ backgroundColor: '#0b3955', padding: '12px 16px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
            <Mic size={18} />
            ระบบจดชื่อและคำขึ้นต้น
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full transition-colors">
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, overflowY: 'auto' }}>
          {/* Settings Section */}
          {showSettings && (
            <div style={{ padding: '12px', backgroundColor: '#f3f4f6', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#374151' }}>การตั้งค่าเสียง</div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span>ความไวการรับเสียง (Sensitivity)</span>
                  <span>{sensitivity}</span>
                </div>
                <input 
                  type="range" min="1" max="50" value={sensitivity} 
                  onChange={(e) => setSensitivity(parseInt(e.target.value))}
                  style={{ width: '100%', accentColor: '#2563eb' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span>ระดับขยายเสียง (Gain)</span>
                  <span>{gain.toFixed(1)}x</span>
                </div>
                <input 
                  type="range" min="0.5" max="5.0" step="0.1" value={gain} 
                  onChange={(e) => setGain(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: '#2563eb' }}
                />
              </div>
            </div>
          )}

          {/* Status & Control */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: '#f9fafb', padding: '12px', borderRadius: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ 
                  width: '12px', 
                  height: '12px', 
                  borderRadius: '50%', 
                  backgroundColor: isListening ? '#10b981' : '#d1d5db',
                  boxShadow: isListening ? '0 0 0 4px rgba(16, 185, 129, 0.2)' : 'none'
                }} />
                <div style={{ fontSize: '14px', fontWeight: 500, color: '#374151' }}>
                  {isListening ? 'กำลังทำงาน' : 'ปิดการทำงาน'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => setShowSettings(!showSettings)}
                  style={{
                    backgroundColor: showSettings ? '#e5e7eb' : 'transparent',
                    color: '#4b5563',
                    border: '1px solid #e5e7eb',
                    padding: '6px',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                  title="ตั้งค่า"
                >
                  <Settings size={14} />
                </button>
                <button 
                  onClick={isListening ? stopListening : startListening}
                  style={{
                    backgroundColor: isListening ? '#ef4444' : '#2563eb',
                    color: 'white',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {isListening ? <Square size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                  {isListening ? 'หยุด' : 'เริ่มทำงาน'}
                </button>
              </div>
            </div>
            
            {isListening && (
              <canvas 
                ref={canvasRef} 
                width={280} 
                height={30} 
                style={{ width: '100%', height: '30px', borderRadius: '4px', backgroundColor: '#f3f4f6' }} 
              />
            )}
          </div>

          {/* Current Speaker Display */}
          {isListening && (
            <div style={{ textAlign: 'center', padding: '10px', backgroundColor: '#eff6ff', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
              <div style={{ fontSize: '10px', color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: '4px' }}>
                ตรวจพบผู้พูดปัจจุบัน
              </div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#1e3a8a' }}>
                {currentSpeakerId ? profiles.find(p => p.id === currentSpeakerId)?.name || 'กำลังวิเคราะห์...' : 'เงียบ...'}
              </div>
            </div>
          )}

          {/* Speaker List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Users size={14} />
              รายชื่อที่ระบบจำได้ ({profiles.length})
            </div>
            
            {profiles.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af', fontSize: '13px', border: '1px dashed #e5e7eb', borderRadius: '12px' }}>
                ยังไม่มีข้อมูลผู้พูด<br/>เริ่มพูดเพื่อให้ระบบจดจำโดยอัตโนมัติ
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {profiles.map(profile => (
                  <div 
                    key={profile.id} 
                    onDoubleClick={() => {
                      setEditingId(profile.id);
                      setEditingName(profile.name);
                    }}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      padding: '10px 12px', 
                      backgroundColor: currentSpeakerId === profile.id ? '#f3f4f6' : 'white',
                      border: currentSpeakerId === profile.id ? '2px solid' : '1px solid #e5e7eb',
                      borderColor: currentSpeakerId === profile.id ? profile.color : '#e5e7eb',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {editingId === profile.id ? (
                      <div style={{ display: 'flex', gap: '6px', width: '100%' }} onClick={(e) => e.stopPropagation()}>
                        <input 
                          autoFocus
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                          style={{ flex: 1, padding: '2px 8px', borderRadius: '4px', border: '1px solid #3b82f6', outline: 'none', fontSize: '14px' }}
                        />
                        <button onClick={handleRename} style={{ color: '#10b981' }}><RefreshCw size={16} /></button>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: profile.color }} />
                          <div style={{ fontSize: '14px', fontWeight: 600 }}>{profile.name}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingId(profile.id);
                              setEditingName(profile.name);
                            }}
                            className="text-gray-400 hover:text-blue-500 transition-colors"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteProfile(profile.id);
                            }}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '12px', borderTop: '1px solid #f3f4f6', backgroundColor: '#f9fafb', fontSize: '11px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Settings size={12} />
          ดับเบิ้ลคลิกที่ชื่อเพื่อแก้ไข
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
