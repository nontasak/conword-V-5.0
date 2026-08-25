import React, { useState, useRef, useEffect } from 'react';
import { X, SpellCheck, Loader2, AlertCircle, CheckCircle2, BrainCircuit } from 'lucide-react';
// import { GoogleGenAI, Type } from '@google/genai';
// import { PROMPT_TEMPLATE } from './constants';
import { checkSpecificWords, RuleBasedResult } from './utils';

interface ThaiProofAIModalProps {
  onClose: () => void;
}

export const ThaiProofAIModal: React.FC<ThaiProofAIModalProps> = ({ onClose }) => {
  const [inputText, setInputText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [ruleBasedResults, setRuleBasedResults] = useState<RuleBasedResult[]>([]);
  const [aiResults, setAiResults] = useState<RuleBasedResult[]>([]);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const resultsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (resultsEndRef.current) {
      resultsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [aiResults, ruleBasedResults]);

  const handleAnalyze = async () => {
    if (!inputText.trim()) {
      setError('กรุณาใส่ข้อความที่ต้องการตรวจสอบ');
      return;
    }

    setIsAnalyzing(true);
    setError('');
    setAiResults([]);
    setRuleBasedResults([]);

    try {
      // 1. Rule-based Check (Fast offline dictionary check - no RPM consumed)
      const ruleResults = checkSpecificWords(inputText);
      setRuleBasedResults(ruleResults);
      setProgress({ current: 1, total: 1 });

      /*
      // --- AI Context Check (Disabled to prevent Rate Limit / RPM Exceeded) ---
      // 2. Chunking with Line Numbers
      const chunks = chunkText(inputText, 10000);
      setProgress({ current: 0, total: chunks.length });

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('ไม่พบ API Key สำหรับ Gemini');
      }

      const ai = new GoogleGenAI({ apiKey });

      let completedChunks = 0;
      const generatePromises = chunks.map(async (chunk, index) => {
        const prompt = `${PROMPT_TEMPLATE}\n${chunk}`;
        
        try {
          await new Promise(res => setTimeout(res, index * 100));
          
          const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
              temperature: 0.1,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    original: { type: Type.STRING, description: "คำที่พิมพ์ผิดในต้นฉบับ" },
                    suggestion: { type: Type.STRING, description: "คำแก้ไขที่ถูกต้อง" },
                    reason: { type: Type.STRING, description: "เหตุผลสั้นๆ ในการแก้ไข" }
                  },
                  required: ["original", "suggestion", "reason"]
                }
              }
            }
          });

          const resultText = response.text || '[]';
          let parsedResults: RuleBasedResult[] = [];
          
          try {
            parsedResults = JSON.parse(resultText);
          } catch (parseError) {
            console.error('Failed to parse AI JSON response:', parseError);
          }
          
          completedChunks++;
          setProgress({ current: completedChunks, total: chunks.length });
          
          if (Array.isArray(parsedResults) && parsedResults.length > 0) {
             setAiResults(prev => [...prev, ...parsedResults]);
          }
        } catch (apiError: any) {
          console.error('API Error in chunk', index, ':', apiError);
          completedChunks++;
          setProgress({ current: completedChunks, total: chunks.length });
          
          if (apiError.message?.includes('429') || apiError.status === 429) {
            throw new Error('ระบบมีการใช้งานเกินขีดจำกัด (Rate Limit Exceeded) กรุณารอสักครู่แล้วลองใหม่อีกครั้ง');
          }
          throw apiError;
        }
      });
      
      await Promise.all(generatePromises);
      */

    } catch (err: any) {
      console.error('Analysis Error:', err);
      setError(err.message || 'เกิดข้อผิดพลาดในการวิเคราะห์');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <SpellCheck size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">ThaiProof-AI</h2>
              <p className="text-sm text-gray-500">ระบบตรวจสอบคำผิดภาษาไทยแบบ Hybrid (Rule-based + AI)</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
            
            {/* Left Column: Input */}
            <div className="flex flex-col gap-4 h-full">
              <div className="flex-1 flex flex-col">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ข้อความที่ต้องการตรวจสอบ
                </label>
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="วางข้อความภาษาไทยที่นี่..."
                  className="flex-1 p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-base leading-relaxed"
                />
              </div>
              
              <button
                onClick={handleAnalyze}
                disabled={isAnalyzing || !inputText.trim()}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl font-medium shadow-sm transition-colors flex items-center justify-center gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    กำลังตรวจสอบ...
                  </>
                ) : (
                  <>
                    <SpellCheck size={18} />
                    ตรวจสอบคำผิด
                  </>
                )}
              </button>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-700 text-sm">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <p>{error}</p>
                </div>
              )}
            </div>

            {/* Right Column: Results */}
            <div className="flex flex-col h-full border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
              <div className="px-4 py-3 bg-gray-100 border-b border-gray-200 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">ผลการตรวจสอบ</span>
                {isAnalyzing && progress.total > 0 && (
                  <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded-full flex items-center gap-1">
                    <Loader2 size={12} className="animate-spin" />
                    กำลังตรวจส่วนที่ {progress.current}/{progress.total}
                  </span>
                )}
              </div>
              
              <div className="flex-1 p-6 overflow-y-auto">
                {!isAnalyzing && ruleBasedResults.length === 0 && aiResults.length === 0 && (
                  <div className="h-full flex items-center justify-center text-gray-400 text-sm text-center">
                    ใส่ข้อความแล้วกด "ตรวจสอบคำผิด"<br/>เพื่อดูผลลัพธ์ที่นี่
                  </div>
                )}

                {/* Rule-based Results */}
                {ruleBasedResults.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-sm font-semibold text-blue-600 mb-4 flex items-center gap-2">
                      <AlertCircle size={16} />
                      ข้อผิดพลาดที่พบจากระบบฐานข้อมูล (Rule-based)
                    </h3>
                    <div className="space-y-4">
                      {ruleBasedResults.map((res, idx) => (
                        <div key={idx} className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm shadow-sm">
                          <div className="font-bold text-blue-800 mb-3 text-left">คำผิดที่ {idx + 1}</div>
                          <div className="text-gray-800 mb-3 flex items-center justify-center gap-3 bg-white/60 py-3 rounded-md border border-blue-100/50">
                            <code className="bg-white px-3 py-1.5 rounded-md text-red-600 border border-red-100 shadow-sm text-base">{res.original}</code> 
                            <span className="text-blue-300 font-medium">{'->'}</span> 
                            <strong className="text-green-600 bg-green-50 px-3 py-1.5 rounded-md border border-green-100 shadow-sm text-base">{res.suggestion}</strong>
                          </div>
                          <div className="text-blue-800 text-left leading-relaxed"><span className="font-semibold">เหตุผล:</span> {res.reason}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Divider */}
                {ruleBasedResults.length > 0 && aiResults.length > 0 && (
                  <div className="my-8 border-t border-gray-200 relative">
                    <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-gray-50 px-3 text-xs font-medium text-gray-400 rounded-full border border-gray-200">
                      ผลลัพธ์จาก AI
                    </span>
                  </div>
                )}

                {/* AI Results */}
                {aiResults.length > 0 && (
                  <div className="mb-6">
                    {ruleBasedResults.length === 0 && (
                      <h3 className="text-sm font-semibold text-blue-600 mb-4 flex items-center gap-2">
                        <BrainCircuit size={16} />
                        ข้อผิดพลาดที่พบจาก AI
                      </h3>
                    )}
                    <div className="space-y-4">
                      {aiResults.map((res, idx) => (
                        <div key={`ai-${idx}`} className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm shadow-sm">
                          <div className="font-bold text-blue-800 mb-3 text-left">คำผิดที่ {(ruleBasedResults.length) + idx + 1}</div>
                          <div className="text-gray-800 mb-3 flex items-center justify-center gap-3 bg-white/60 py-3 rounded-md border border-blue-100/50">
                            <code className="bg-white px-3 py-1.5 rounded-md text-red-600 border border-red-100 shadow-sm text-base">{res.original}</code> 
                            <span className="text-blue-300 font-medium">{'->'}</span> 
                            <strong className="text-green-600 bg-green-50 px-3 py-1.5 rounded-md border border-green-100 shadow-sm text-base">{res.suggestion}</strong>
                          </div>
                          <div className="text-blue-800 text-left leading-relaxed"><span className="font-semibold">เหตุผล:</span> {res.reason}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Success State */}
                {!isAnalyzing && (ruleBasedResults.length > 0 || aiResults.length > 0) && (
                  <div className="mt-8 p-4 bg-green-50 border border-green-100 rounded-lg flex items-center justify-center gap-2 text-green-700 text-sm font-medium shadow-sm">
                    <CheckCircle2 size={18} />
                    <span>ตรวจสอบเสร็จสมบูรณ์</span>
                  </div>
                )}

                {/* No Errors State */}
                {!isAnalyzing && inputText.trim() && ruleBasedResults.length === 0 && aiResults.length === 0 && progress.total > 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-green-600 gap-3">
                    <div className="p-4 bg-green-50 rounded-full">
                      <CheckCircle2 size={32} />
                    </div>
                    <div className="text-center">
                      <p className="font-medium text-lg">ไม่พบข้อผิดพลาด</p>
                      <p className="text-sm text-green-700/70 mt-1">เอกสารฉบับนี้ตรวจสอบแล้ว ไม่พบคำผิดที่ชัดเจน</p>
                    </div>
                  </div>
                )}

                <div ref={resultsEndRef} />
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
