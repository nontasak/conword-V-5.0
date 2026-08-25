import React, { useState } from 'react';
import { X, BrainCircuit, Loader2, CheckCircle2, AlertCircle, Copy, PanelLeft } from 'lucide-react';
// import { GoogleGenAI } from '@google/genai';

interface AITrainingModalProps {
  onClose: () => void;
}

interface ProposedRule {
  id: string;
  text: string;
  selected: boolean;
}

export const AITrainingModal: React.FC<AITrainingModalProps> = ({ onClose }) => {
  const [rawText, setRawText] = useState('');
  const [aiText, setAiText] = useState('');
  const [humanText, setHumanText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [proposedRules, setProposedRules] = useState<ProposedRule[]>([]);
  const [finalOutput, setFinalOutput] = useState('');
  const [error, setError] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [showInputs, setShowInputs] = useState(true);

  const handleAnalyze = async () => {
    if (!rawText.trim() || !aiText.trim() || !humanText.trim()) {
      setError('กรุณากรอกข้อมูลให้ครบทั้ง 3 ช่อง (ข้อความดิบ, ข้อความ AI, ข้อความที่แก้ไขแล้ว)');
      return;
    }

    setIsAnalyzing(true);
    setError('');
    setProposedRules([]);
    setFinalOutput('');

    try {
      /*
      // --- AI Prompt Rules Generator (Disabled to prevent Rate Limit / RPM Exceeded) ---
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error('ไม่พบ GEMINI_API_KEY');
      const ai = new GoogleGenAI({ apiKey });

      const prompt = `
      คุณคือผู้เชี่ยวชาญด้านการบรรณาธิการและวิศวกรรม Prompt
      หน้าที่ของคุณคือเปรียบเทียบข้อความ 3 ส่วน เพื่อสกัด "กฎการบรรณาธิการ (Editing Rules)" ที่เป็นมาตรฐาน โดยสรุปเฉพาะกฎที่สำคัญที่สุด ตรงประเด็น และไม่ซ้ำซ้อน (สูงสุดไม่เกิน 5 ข้อ)
      
      [Raw Text] (ข้อความดิบจากการถอดเสียง)
      ${rawText}

      [AI Text] (ข้อความที่ AI จัดรูปแบบแล้ว แต่ยังมีข้อผิดพลาด)
      ${aiText}
      
      [Human Text] (ข้อความที่มนุษย์แก้ไขให้ถูกต้องที่สุด)
      ${humanText}
      
      มาตรฐานการวิเคราะห์และสร้างกฎ (Standard Operating Procedure):
      1. วิเคราะห์เฉพาะจุดที่มนุษย์แก้ไขจาก AI Text อย่างมีนัยสำคัญเท่านั้น
      2. หาก AI Text ลบคำที่มีใน Raw Text แต่มนุษย์นำกลับมาใน Human Text ให้สร้างกฎ "ห้ามลบ..." พร้อมระบุบริบท
      3. หากมนุษย์เปลี่ยนคำจาก AI Text ให้สร้างกฎ "เปลี่ยนคำว่า [A] เป็น [B]"
      4. กฎทุกข้อต้องเขียนในรูปแบบคำสั่งที่ชัดเจน (Actionable) ไม่กำกวม และระบุเงื่อนไขให้ชัดเจน
      
      ส่งออกผลลัพธ์เป็น JSON Array ของ String เท่านั้น ห้ามมีข้อความอื่น
      ตัวอย่างที่ได้มาตรฐาน: 
      [
        "หากพบคำว่า 'แอป' ให้เปลี่ยนเป็น 'แอปพลิเคชัน' เสมอ",
        "ห้ามตัดคำว่า 'งบประมาณ' ทิ้งเด็ดขาด เนื่องจากเป็นใจความสำคัญ"
      ]
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json'
        }
      });

      const resultText = response.text || '[]';
      let rulesArray: string[] = [];
      try {
        rulesArray = JSON.parse(resultText);
      } catch (e) {
        throw new Error('ไม่สามารถอ่านผลลัพธ์จาก AI ได้ กรุณาลองใหม่อีกครั้ง');
      }

      if (!Array.isArray(rulesArray) || rulesArray.length === 0) {
        throw new Error('ไม่พบความแตกต่างที่สามารถสรุปเป็นกฎได้');
      }

      const formattedRules: ProposedRule[] = rulesArray.map((rule, index) => ({
        id: `rule-${index}`,
        text: rule,
        selected: true
      }));

      setProposedRules(formattedRules);
      */
      setError('ระบบ AI ปิดการทำงานชั่วคราวเพื่อป้องกันการใช้งานเกินขีดจำกัด (RPM Exceeded)');
    } catch (err: any) {
      console.error('Analysis Error:', err);
      setError(err.message || 'เกิดข้อผิดพลาดในการวิเคราะห์');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleToggleRule = (id: string) => {
    setProposedRules(prev => 
      prev.map(rule => rule.id === id ? { ...rule, selected: !rule.selected } : rule)
    );
  };

  const handleRuleTextChange = (id: string, newText: string) => {
    setProposedRules(prev => 
      prev.map(rule => rule.id === id ? { ...rule, text: newText } : rule)
    );
  };

  const handleGenerateOutput = () => {
    const selectedRules = proposedRules.filter(r => r.selected);
    if (selectedRules.length === 0) {
      setError('กรุณาเลือกกฎอย่างน้อย 1 ข้อ');
      return;
    }

    const outputString = `ช่วยอัปเดต Master SOP ในโค้ดให้หน่อย โดยเพิ่มกฎใหม่เหล่านี้เข้าไป:\n\n${selectedRules.map(r => `- ${r.text}`).join('\n')}`;
    setFinalOutput(outputString);
  };

  const handleCopyOutput = () => {
    if (finalOutput) {
      navigator.clipboard.writeText(finalOutput);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-[95vw] h-[95vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
              <BrainCircuit size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">สอน AI (Rule Analyzer)</h2>
              <p className="text-sm text-gray-500">วิเคราะห์การแก้ไขข้อความเพื่อสร้างกฎบรรณาธิการใหม่</p>
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
        <div className="flex-1 overflow-y-auto p-6">
          <div className={`grid gap-6 h-full ${showInputs ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
            
            {/* Left Column: Inputs */}
            {showInputs && (
              <div className="flex flex-col gap-4">
                <div className="flex-1 flex flex-col">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    1. ข้อความดิบ (Raw Text)
                  </label>
                  <textarea
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder="วางข้อความดิบจากการถอดเสียงที่นี่..."
                    className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none text-sm font-mono min-h-[100px]"
                  />
                </div>
                <div className="flex-1 flex flex-col">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    2. ข้อความที่ AI พิมพ์ (AI Text)
                  </label>
                  <textarea
                    value={aiText}
                    onChange={(e) => setAiText(e.target.value)}
                    placeholder="วางข้อความที่ AI สร้างขึ้นที่นี่..."
                    className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none text-sm font-mono min-h-[100px]"
                  />
                </div>
                <div className="flex-1 flex flex-col">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    3. ข้อความที่แก้ไขแล้ว (Human Text)
                  </label>
                  <textarea
                    value={humanText}
                    onChange={(e) => setHumanText(e.target.value)}
                    placeholder="วางข้อความที่คุณแก้ไขแล้วที่นี่..."
                    className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none text-sm font-mono min-h-[100px]"
                  />
                </div>
                
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || !rawText.trim() || !aiText.trim() || !humanText.trim()}
                  className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white rounded-lg font-medium shadow-sm transition-colors flex items-center justify-center gap-2"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      กำลังวิเคราะห์ความแตกต่าง...
                    </>
                  ) : (
                    <>
                      <BrainCircuit size={18} />
                      วิเคราะห์และสร้างกฎ
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
            )}

            {/* Right Column: Proposed Rules & Output */}
            <div className="flex flex-col h-full border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
              <div className="px-4 py-2 bg-gray-100 border-b border-gray-200 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">4. ตรวจสอบและอนุมัติกฎใหม่</span>
                {!showInputs && (
                  <button onClick={() => setShowInputs(true)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                    <PanelLeft size={14} /> แสดงกล่องข้อความต้นฉบับ
                  </button>
                )}
              </div>
              
              <div className="flex-1 p-4 overflow-y-auto">
                {proposedRules.length === 0 && !isAnalyzing && !finalOutput && (
                  <div className="h-full flex items-center justify-center text-gray-400 text-sm text-center">
                    ใส่ข้อความทั้งสามช่องแล้วกด "วิเคราะห์และสร้างกฎ"<br/>เพื่อดูผลลัพธ์ที่นี่
                  </div>
                )}

                {proposedRules.length > 0 && !finalOutput && (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600 mb-4">
                      เลือกกฎที่คุณต้องการนำไปใช้ และสามารถแก้ไขข้อความของกฎได้โดยตรง
                    </p>
                    {proposedRules.map((rule) => (
                      <div key={rule.id} className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                        <input
                          type="checkbox"
                          checked={rule.selected}
                          onChange={() => handleToggleRule(rule.id)}
                          className="mt-1.5 rounded text-purple-600 focus:ring-purple-500"
                        />
                        <textarea
                          value={rule.text}
                          onChange={(e) => handleRuleTextChange(rule.id, e.target.value)}
                          className="flex-1 text-lg text-gray-800 bg-transparent border-none focus:ring-0 p-0 resize-none"
                          rows={3}
                        />
                      </div>
                    ))}
                    
                    <button
                      onClick={handleGenerateOutput}
                      className="w-full mt-4 py-2 px-4 bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-medium shadow-sm transition-colors"
                    >
                      สรุปกฎเพื่ออัปเดตโค้ด
                    </button>
                  </div>
                )}

                {finalOutput && (
                  <div className="h-full flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-green-700 flex items-center gap-1">
                        <CheckCircle2 size={16} />
                        สรุปกฎเรียบร้อยแล้ว
                      </span>
                      <button
                        onClick={() => {
                          setFinalOutput('');
                          setProposedRules([]);
                          setShowInputs(true);
                        }}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        วิเคราะห์ใหม่
                      </button>
                    </div>
                    <textarea
                      readOnly
                      value={finalOutput}
                      className="flex-1 w-full bg-white border border-gray-200 rounded-lg p-3 text-sm font-mono resize-none focus:outline-none"
                    />
                    <button
                      onClick={handleCopyOutput}
                      className={`mt-3 w-full py-2 px-4 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                        copySuccess ? 'bg-green-500 hover:bg-green-600' : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      {copySuccess ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                      {copySuccess ? 'คัดลอกข้อความแล้ว' : 'คัดลอกข้อความเพื่อส่งให้ AI อัปเดตโค้ด'}
                    </button>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
