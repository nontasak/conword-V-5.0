import React, { useState, useRef } from 'react';
import { X, Upload, FileAudio, Loader2, CheckCircle2, AlertCircle, Copy, FileText, Download, Check, ChevronRight, ChevronDown } from 'lucide-react';
// import { GoogleGenAI } from '@google/genai';

interface CommitteeReportGeneratorModalProps {
  onClose: () => void;
  onInsertText: (text: string) => void;
}

export const CommitteeReportGeneratorModal: React.FC<CommitteeReportGeneratorModalProps> = ({ onClose, onInsertText }) => {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [speakerList, setSpeakerList] = useState<string>('');
  const [isManualRawText, setIsManualRawText] = useState<boolean>(false);
  const [manualRawText, setManualRawText] = useState<string>('');
  const [status, setStatus] = useState<'IDLE' | 'UPLOADING' | 'TRANSCRIBING' | 'EDITING' | 'COMPLETE' | 'ERROR'>('IDLE');
  const [progressText, setProgressText] = useState<string>('');
  const [finalReport, setFinalReport] = useState<string>('');
  const [rawTranscription, setRawTranscription] = useState<string>('');
  const [showRawText, setShowRawText] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [insertSuccess, setInsertSuccess] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setAudioFile(e.target.files[0]);
      setStatus('IDLE');
      setError('');
      setFinalReport('');
      setRawTranscription('');
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          // Remove the data URL prefix (e.g., "data:audio/mp3;base64,")
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        } else {
          reject(new Error('Failed to convert file to base64'));
        }
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleGenerate = async () => {
    if (!isManualRawText && !audioFile) {
      setError('กรุณาอัปโหลดไฟล์เสียง หรือเลือกกรอกข้อความดิบด้วยตนเอง');
      return;
    }
    if (isManualRawText && !manualRawText.trim()) {
      setError('กรุณากรอกข้อความดิบ');
      return;
    }
    if (!speakerList.trim()) {
      setError('กรุณาระบุข้อมูลเบื้องต้นและรายชื่อผู้พูด');
      return;
    }

    try {
      /*
      // --- Gemini AI Audio Transcription & Report Generation (Disabled to prevent Rate Limit / RPM Exceeded) ---
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error('ไม่พบ GEMINI_API_KEY');
      const ai = new GoogleGenAI({ apiKey });

      let rawText = '';

      if (isManualRawText) {
        rawText = manualRawText;
        setRawTranscription(rawText);
      } else {
        setStatus('UPLOADING');
        const isSmallFile = audioFile!.size < 20 * 1024 * 1024; // 20MB

        if (isSmallFile) {
          setProgressText('กำลังแปลงไฟล์และถอดเสียง (Inline Data สำหรับไฟล์ < 20MB)...');
          const base64Data = await fileToBase64(audioFile!);
          
          setStatus('TRANSCRIBING');
          const promptStt = `
          คุณคือผู้เชี่ยวชาญด้านการถอดรหัสเสียง 
          กฎเหล็ก 5 ข้อ: ต้องครบถ้วน 100%
          1. ถอดข้อความจากไฟล์เสียงนี้แบบ 'คำต่อคำ' (Verbatim) ทุกคำที่ได้ยิน
          2. ห้ามละคำหรือประโยคใด ๆ ห้ามข้ามประโยคแม้จะดูไม่สำคัญ
          3. ห้ามสรุปความเด็ดขาด
          4. ห้ามย่อความเด็ดขาด
          5. พิมพ์ออกมาเป็นข้อความดิบยาวต่อเนื่อง ไม่ต้องพยายามจัดย่อหน้า
          `;

          const sttResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
              {
                inlineData: {
                  data: base64Data,
                  mimeType: audioFile!.type || 'audio/mp3'
                }
              },
              promptStt
            ]
          });

          rawText = sttResponse.text || '';
          setRawTranscription(rawText);
        } else {
          setProgressText('กำลังอัปโหลดไฟล์เสียงไปยังเซิร์ฟเวอร์ (ไฟล์ > 20MB)...');
          
          // Upload file using the File API
          const uploadedFile = await ai.files.upload({
            file: audioFile!,
            config: {
              mimeType: audioFile!.type || 'audio/mp3',
            }
          });

          setProgressText('กำลังเตรียมไฟล์เสียงบนคลาวด์ (อาจใช้เวลาสักครู่)...');
          let fileInfo = await ai.files.get({ name: uploadedFile.name });
          
          // Poll for processing completion (timeout after ~5 minutes)
          let attempts = 0;
          while (fileInfo.state === 'PROCESSING' && attempts < 150) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            fileInfo = await ai.files.get({ name: uploadedFile.name });
            attempts++;
          }

          if (fileInfo.state === 'FAILED') {
            throw new Error('การเตรียมไฟล์เสียงล้มเหลว กรุณาลองใหม่อีกครั้ง');
          }
          if (fileInfo.state === 'PROCESSING') {
            throw new Error('หมดเวลารอการเตรียมไฟล์เสียง กรุณาลองไฟล์ที่เล็กลง');
          }

          // STEP 1: Transcribe
          setStatus('TRANSCRIBING');
          setProgressText('กำลังถอดเสียงเป็นข้อความดิบ (Step 1/2)...');
          
          const promptStt = `
          คุณคือผู้เชี่ยวชาญด้านการถอดรหัสเสียง 
          กฎเหล็ก 5 ข้อ: ต้องครบถ้วน 100%
          1. ถอดข้อความจากไฟล์เสียงนี้แบบ 'คำต่อคำ' (Verbatim) ทุกคำที่ได้ยิน
          2. ห้ามละคำหรือประโยคใด ๆ ห้ามข้ามประโยคแม้จะดูไม่สำคัญ
          3. ห้ามสรุปความเด็ดขาด
          4. ห้ามย่อความเด็ดขาด
          5. พิมพ์ออกมาเป็นข้อความดิบยาวต่อเนื่อง ไม่ต้องพยายามจัดย่อหน้า
          `;

          const sttResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
              {
                fileData: {
                  fileUri: fileInfo.uri,
                  mimeType: fileInfo.mimeType
                }
              },
              promptStt
            ]
          });

          rawText = sttResponse.text || '';
          setRawTranscription(rawText);
        }
      }

      // STEP 2: Proxy Editor
      setStatus('EDITING');
      setProgressText('กำลังจัดทำรายงานและทำศัลยกรรมตกแต่ง (Step 2/2)...');

      const masterSop = `
      คุณคือ "บรรณาธิการตัวแทน" (Proxy Editor) สำหรับจัดทำรายงานการประชุม
      ปรัชญา: ทำ "ศัลยกรรมตกแต่ง (Surgical Editing)" ทำให้ข้อความอ่านง่าย เป็นทางการ โดยตัดเฉพาะส่วนเกินและปรับคำ ห้ามสรุปความ ห้ามแต่งประโยคใหม่ และห้ามทำให้สาระสำคัญหรือตรรกะเดิมสูญหาย 100%
      **คำเตือนสำคัญสูงสุด: ห้ามตัดทอนเนื้อหาเด็ดขาด ต้องพิมพ์ออกมาให้ครบทุกประโยคที่มีในข้อความดิบ ห้ามสรุปความหรือรวบรัดข้อความโดยเด็ดขาด**
      
      [กฎเหล็กที่ห้ามละเมิด]
      1. รายชื่อผู้พูดคือประกาศิต: ห้ามแก้ไข ตัดทอน เพิ่มเติม ชื่อและตำแหน่งใน "รายชื่อผู้พูด" เด็ดขาด ให้ใช้วิธี Copy & Paste เท่านั้น
      2. โครงสร้างต้องยึดตามรายชื่อ 100%: ลำดับการพูดต้องเรียงตามรายชื่อที่จดมาเป๊ะ ห้ามสร้างผู้พูดใหม่แทรก
      3. รักษาความต่อเนื่อง: หากมีเสียงคนอื่นพูดแทรกขัดจังหวะ ให้ดึงใจความผู้พูดหลักมาต่อกันเป็นก้อนเดียว (1 ย่อหน้ายาว) ห้ามเอาคำพูดแทรกมาปะปน
      4. ห้ามทำข้อความตกหล่น: ข้อความดิบมีกี่ประโยค ต้องถอดความออกมาให้ครบทุกประโยค ห้ามข้ามเด็ดขาด
      
      [เฟส 0: กวาดล้างคำฟุ่มเฟือยและคำซ้ำ]
      - ลบทิ้ง 100%: ฮะ, นะครับ, เนาะ, มั้ย, ครับ, นะคะ, ค่ะ, เนี่ย, เนี้ย, ไอ้, น่ะ, อ่ะ, เงี้ย, นะฮะ, ฮ่า, แว๊บ ๆ, เอ้ย, โอ้โห, เอ้า, เออ, นี่แหละ, อยู่นะ, ตามนั้น, ก็แล้วแต่, นู้น, นี่ก็, อะไรนะ, นั่นแหละ, เอ่อ, ตัวของ, ที่ด่าน, นั้น, ป๋า, ก็เลย, ขอสไลด์ต่อไป, สไลด์ต่อไป, ปุ๊บ, แหละ, ป่ะ, มั้ง, ใช่ป่ะ, ด้วยป่ะ, อะไรอย่างงี้, อะไรอย่างนี้, อินดี้, อ่าก็, นาฬิกาะ, แล้วกัน, ป๋อง, เอาไง, หน่อย, เดี๋ยว (บริบทเกริ่นนำ), เป๊ะๆ, ยาวเป็นพืด, อะไรต่ออะไร, ครั้นว่า, อะไรสักอย่างหนึ่ง, นะ, ล่ะ, อยู่แล้ว, ก็นะ
      - คำพูดติดขัด/พูดซ้ำ: ลบและยุบรวม (เช่น "ในในพื้นที่" -> "ในพื้นที่", "ได้ ได้ได้" -> "ได้")
      
      [เฟส 1: เปลี่ยนภาษาพูดเป็นภาษาเขียน (1-to-1)]
      - เมื่อกี้/เมื่อตะกี้ -> เมื่อสักครู่นี้
      - งั้น -> อย่างนั้น
      - ยังไง -> อย่างไร
      - อาทิตย์ที่แล้ว/อาทิตย์หน้า -> สัปดาห์ที่แล้ว/สัปดาห์หน้า
      - ค่อนข้างเยอะ -> ค่อนข้างมาก
      - ได้มีโอกาสได้ -> มีโอกาสได้
      - หลาย ๆ ครั้ง -> หลายครั้ง
      - ก๊อป -> คัดลอก
      - เช็ก -> ตรวจสอบ
      - ดร. -> ดอกเตอร์ (เขียนเต็มยศ)
      - หรือเปล่า -> หรือไม่
      - 1 ในนั้น/๑ ในนั้น -> หนึ่งในนั้น
      - สมมติ/สมมุติ -> สมมุติว่า
      - พี่ [ชื่อ] / ท่าน [ชื่อ] -> เปลี่ยนเป็น ชื่อ-นามสกุล หรือ ตำแหน่งตาม Master Data
      
      [เฟส 2: จัดการคำศัพท์และชื่อเฉพาะ]
      - คำย่อหน่วยงาน: พิมพ์ตามที่ได้ยินเป๊ะๆ (เช่น ป.ป.ช., ก.พ.ร., SCB, BOT) ห้ามขยายเป็นชื่อเต็ม แต่ใส่จุดให้ถูก
      - ขยายชื่อเต็ม: ถ้าพูดชื่อหน่วยงานไม่ครบ (เช่น กระทรวงพัฒนาสังคม) ให้ขยายเป็นเต็ม (กระทรวงการพัฒนาสังคมและความมั่นคงของมนุษย์), ชื่อจังหวัด, ชื่อกฎหมาย, คณะกรรมาธิการ สว.
      - ตรวจสอบชื่อ-นามสกุลในเนื้อหา: หากเอ่ยถึงชื่อคน ต้องเช็กกับ Master Data และแก้ให้ถูก
      - สรรพนาม "มัน": ลบทิ้งหากไม่สุภาพ/ไม่จำเป็น คงไว้ถ้าเป็นคำนาม (น้ำมัน) หรือรสชาติ
      - สัญลักษณ์ % -> เปอร์เซ็นต์
      
      [เฟส 3: ทับศัพท์อัจฉริยะ]
      - นิยมทับศัพท์: digital -> ดิจิทัล, computer -> คอมพิวเตอร์, PowerPoint -> พาวเวอร์พ็อยนต์
      - คงภาษาอังกฤษไว้: Robinhood, application, ecosystem, platform, rider, GP, CSR, API, NocNoc, marketing, late, support, project, solution
      
      [เฟส 4: กฎตามบริบทเฉพาะ]
      - วรรค + เลข -> เปลี่ยนเลขเป็นตัวอักษร (เช่น วรรค 2 -> วรรคสอง)
      - อนุ + เลขคำอ่าน -> เลขไทยในวงเล็บ (เช่น อนุหนึ่ง -> (๑))
      - เลขกลมๆ หลักแสน/ล้าน -> ใช้ [เลขไทย] + [หน่วย] (เช่น 800,000 บาท -> ๘ แสนบาท, 2,000,000 บาท -> ๒ ล้านบาท)
      - เลขา -> เลขานุการ (ยกเว้น เลขาธิการ ให้คงไว้)
      - กรรมการ vs กรรมาธิการ -> พิมพ์ตามเสียง ไม่ต้องแก้
      
      [เฟส 5: จัดรูปแบบ Final Formatting - สำคัญสูงสุด]
      1. ข้อมูลกำกับ (Metadata): นำชื่อคณะ, วันที่, ผู้จด ไปไว้บรรทัดบนสุด
      2. รูปแบบผู้พูด (ต้องเป๊ะตามนี้): [Tab][Tab][ชื่อ][Space 2 ครั้ง][นามสกุล][Space 3 ครั้ง]:[Space 3 ครั้ง][ข้อความ]
      3. การรวมข้อความ: ข้อความผู้พูด 1 คน ต้องพิมพ์ติดกันยาวเป็นพืดเดียว ห้ามเคาะ Enter กลางประโยคเด็ดขาด จะขึ้นบรรทัดใหม่เฉพาะเมื่อเปลี่ยนผู้พูดเท่านั้น
      4. เว้นวรรค: ใช้ 1 ช่องว่างระหว่างคำเท่านั้น
      5. ไม้ยมก: ให้ใส่เว้นวรรค (space) ระหว่างคำและเครื่องหมาย 'ๆ' เสมอ (เช่น 'ต่าง ๆ ' ไม่ใช่ 'ต่างๆ')
      6. ตัวเลข: เลขไทย (๑, ๒, ๓...) ยกเว้นชื่อแบรนด์/ภาษาอังกฤษ
      7. เวลา: "8.00 น." -> "๐๘.๐๐ นาฬิกา" (เติม 0 ข้างหน้า), ช่วงเวลาใช้ยัติภังค์ (๑๓.๐๐-๑๕.๐๐ นาฬิกา)
      8. ให้ครอบผลลัพธ์ทั้งหมดด้วย Markdown Code Block (\`\`\`) เพื่อรักษารูปแบบอักขระ Tab (\\t) และ Space

      [เฟส 6: กฎเพิ่มเติมจากการเรียนรู้ (AI Training)]
      - ให้ใส่เว้นวรรค (space) ระหว่างคำและเครื่องหมาย 'ๆ' เสมอ (เช่น 'ต่าง ๆ ' ไม่ใช่ 'ต่างๆ')
      - หากพบการพูดชื่ออย่างเดียวในเนื้อหารายงานก็ให้พิมพ์แค่ชื่ออย่างเดียวไม่ต้องพิมพ์นามสกุล 
      - ตัดคำหรือวลีที่ซ้ำซ้อน ไม่จำเป็น หรือมีความหมายโดยนัยอยู่แล้วออก เพื่อให้ข้อความกระชับและตรงประเด็น (เช่น "ที่สถานที่" เป็น "สถานที่" หรือตัดสรรพนาม "มัน" ที่เข้าใจได้ออก)
      - ลบคำพูดติดอ่าง คำขยายที่ไม่จำเป็น และคำอุทาน (เช่น "สักครู่", "นิดเดียว", "แป๊บนึง", "เอ่อ", "อืม", "อ่ะนะคะ") ออกจากข้อความเพื่อความกระชับและเป็นทางการ
      - เปลี่ยนคำเรียกบุคคลที่ไม่เป็นทางการ (เช่น "พี่จ้อย", "พี่ป้อม", "พี่แดง", "น้องฟลุ๊ค") เป็นคำที่เหมาะสมกว่า (เช่น "ท่าน", "ดิฉัน") 
      - ตรวจสอบและแก้ไขการระบุผู้พูดให้ถูกต้องเสมอ โดยเฉพาะเมื่อมีการถามตอบ การแนะนำผู้พูดคนใหม่ หรือการขัดจังหวะบทสนทนา ไม่ระบุคำถามให้ผู้ตอบซ้ำ
      - ระมัดระวังในการลบข้อความ และต้องแน่ใจว่าการลบนั้นไม่ทำให้ข้อมูลสำคัญขาดหายไป หรือความหมายของประโยคผิดเพี้ยน
      - จัดรูปแบบตัวเลขให้เป็นมาตรฐานเดียวกัน (เช่น ใช้เลขอารบิกหรือเลขไทยให้สอดคล้องกับรูปแบบที่กำหนด)
      - หลีกเลี่ยงการเพิ่มรายละเอียดที่ไม่ปรากฏในข้อความดิบ แม้ว่าจะดูสมเหตุสมผลในบริบทก็ตาม

      [ข้อมูลสำหรับทำ Few-Shot Prompting (สอนให้แยก "เนื้อ" กับ "น้ำ")]
      จงดูตัวอย่างการแก้ไขข้อความต่อไปนี้ สังเกตว่าบรรณาธิการลบเฉพาะ 'คำฟุ่มเฟือย' (น้ำ) แต่เก็บ 'บริบทและเหตุผลเชิงลึก' (เนื้อ) ไว้ครบถ้วน 100% ห้ามสรุปความจนข้อเท็จจริงหายไปเด็ดขาด

      [ตัวอย่างที่ 1: การอธิบายโมเดลธุรกิจ (Robinhood)]
      ข้อความดิบ (Raw): "คือแอปใหญ่เขามีเงิน แอปนี่ก็แทบจะไม่มเงินแล้ว ต้องให้สิทธิพิเศษด้วย เราก็ต้องบอกว่าร้านไม่เลือกแน่เพราะต้องเลือกได้แคปแอปเดียว ร้านต้องเลือกแอปที่ได้ออเดอร์เยอะที่สุดเพื่อมาหาเขา เราจะทำยังไงให้แอปให้ร้านมาเลือกเรา เราก็ต้องออกไปเลยว่า GP 0 แอปใหญ่ไม่เอา GP 0 อยู่แล้ว เขาเจอะเยอะ แต่เราก็รู้อยู่แล้วว่าเราต้องเอา GP 0 เพื่อดึงลูกค้า ดึงร้านค้าเข้ามาสมัครกับเรา ซึ่ง GP 0 เนี่ย ทุกออเดอร์เนี่ยเราขาดทุนอยู่แล้ว..."
      การแก้ไขที่ถูกต้อง (Surgical Editing): "คือแอปพลิเคชันใหญ่เขามีเงิน แอปพลิเคชันนี้แทบจะไม่มีเงินแล้ว ต้องให้สิทธิพิเศษด้วย เราต้องบอกว่าร้านไม่เลือกแน่เพราะเลือกได้แค่แอปพลิเคชันเดียว ร้านต้องเลือกแอปพลิเคชันที่ได้ order เยอะที่สุดเพื่อมาหาเขา เราจะทำอย่างไรให้ร้านมาเลือกเรา เราต้องออกไปเลยว่า GP ๐ แอปพลิเคชันใหญ่ไม่เอา GP ๐ อยู่แล้ว เขาเจอเยอะ แต่เรารู้อยู่แล้วว่าเราต้องเอา GP ๐ เพื่อดึงร้านค้าเข้ามาสมัครกับเรา ซึ่ง GP ๐ ทุก order เราขาดทุนอยู่แล้ว"
      เหตุผล: ตรงนี้ห้ามลบประโยคที่ว่า 'ร้านต้องเลือกได้แค่แอปพลิเคชันเดียว' ทิ้งเด็ดขาด เพราะเป็นบริบทสำคัญที่อธิบายว่าทำไมถึงต้องยอมทำ GP 0 สิ่งที่ลบออกคือคำสร้อยเช่น 'เนี่ย', 'แคป', และคำพูดซ้ำ 'ให้แอปให้ร้าน' เท่านั้น

      [ระบบ "Chain of Thought" (ให้คิดในใจก่อนแก้)]
      ทุกครั้งก่อนที่จะสร้างผลลัพธ์ในรูปแบบ Code Block ให้คุณแสดงกระบวนการ [Thinking] โดยต้อง 1. สรุปประเด็นสำคัญ (Key Data Points) ที่ห้ามลบทิ้งเด็ดขาด 2. วางแผนการแก้คำศัพท์ตาม SOP

      [ตัวอย่างการทำงานของ AI ที่ต้องทำ]
      ข้อความดิบ: "การที่จะนำสายลงดินโดยไม่หักเสาเนี่ยนะครับ ต้นทุนในการเอาลงของโอเปอเรเตอร์เนี่ย 1 กิโลเมตรเนี่ย 800,000 บาทถึง 1,200,000 บาท แล้วยังต้องเสียค่า โอเปก ไอ้ที่ผมพูดเมื่อตะกี้นะคือค่า คาเปก นะครับ โอเปก เนี่ยยังต้องจ่ายอยู่อีก 12,000 บาท ต่อ 1 ซับดัก หรือเส้นผ่าศูนย์กลางประมาณ 25 มิลลิเมตรเนี่ย นะครับ 12,000 บาท ให้กับ NT ซึ่งมันสูงมาก นะครับ มันก็เลยทำให้โอเปอเรเตอร์เนี่ย reluctant ในการที่จะเอาลง"
      
      [Thinking]
      สกัดประเด็นสำคัญ (ห้ามตัดทิ้ง):
      - เงื่อนไข: นำสายลงดินโดยไม่หักเสา
      - ต้นทุน (CAPEX) ของ operator: กิโลเมตรละ 800,000 - 1,200,000 บาท
      - ค่าใช้จ่าย (OPEX) ต่อเดือน: 12,000 บาท ต่อ 1 sub-duct (ขนาด 25 มม.) จ่ายให้ NT
      - ผลลัพธ์: ต้นทุนสูง ทำให้ operator ลังเล (reluctant)
      แผนการใช้ SOP (ศัลยกรรมตกแต่ง):
      - ลบคำฟุ่มเฟือย: "เนี่ยนะครับ", "ไอ้ที่ผมพูด", "เมื่อตะกี้นะ", "มัน"
      - ปรับคำศัพท์/ทับศัพท์: โอเปอเรเตอร์ -> operator, โอเปก -> OPEX, คาเปก -> CAPEX, ซับดัก -> sub-duct, reluctant (คงไว้)
      - กฎตัวเลข: 800,000 บาท -> ๘ แสนบาท, 1,200,000 บาท -> ๑.๒ ล้านบาท, 12,000 -> ๑๒,๐๐๐
      ดำเนินการแก้ไข (Execution)...
      
      \`\`\`
      [ชื่อผู้พูด] : การที่จะนำสายลงดินโดยไม่หักเสา ต้นทุนในการเอาลงของ operator ๑ กิโลเมตร ๘ แสนบาทถึง ๑.๒ ล้านบาท และยังต้องเสียค่า OPEX ที่พูดเมื่อสักครู่นี้คือค่า CAPEX OPEX ยังต้องจ่ายอยู่อีก ๑๒,๐๐๐ บาท ต่อ ๑ sub-duct หรือเส้นผ่าศูนย์กลางประมาณ ๒๕ มิลลิเมตร ๑๒,๐๐๐ บาทให้กับ NT ซึ่งสูงมาก จึงทำให้ operator reluctant ในการที่จะเอาลง
      \`\`\`
      `;

      const promptEditor = `
      กรุณาใช้คำสั่ง [Thinking] เพื่อไตร่ตรองและตรวจสอบกฎทุกข้อก่อนพิมพ์ผลลัพธ์เสมอ
      
      [ข้อมูลเบื้องต้นและรายชื่อผู้พูด]
      ${speakerList}
      
      [ข้อความดิบ]
      ${rawText}
      
      จงทำหน้าที่บรรณาธิการตัวแทน ประมวลผลข้อความดิบ จัดกลุ่มข้อความ และจับคู่กับรายชื่อผู้พูดตาม SOP ที่กำหนด และแสดงผลลัพธ์ใน Code Block
      `;

      setFinalReport(''); // Clear previous report before streaming
      const editorResponseStream = await ai.models.generateContentStream({
        model: 'gemini-3.1-pro-preview',
        contents: promptEditor,
        config: {
          systemInstruction: masterSop,
          temperature: 0.2
        }
      });

      let fullText = '';
      for await (const chunk of editorResponseStream) {
        fullText += chunk.text;
        setFinalReport(fullText);
      }

      setStatus('COMPLETE');
      setProgressText('จัดทำรายงานเสร็จสมบูรณ์!');
      */
      setStatus('ERROR');
      setError('ระบบ AI ปิดการทำงานชั่วคราวเพื่อป้องกันการใช้งานเกินขีดจำกัด (RPM Exceeded)');
    } catch (err: any) {
      console.error('Generation Error:', err);
      setStatus('ERROR');
      setError(err.message || 'เกิดข้อผิดพลาดในการประมวลผล');
    }
  };

  const handleInsert = () => {
    if (finalReport) {
      onInsertText(finalReport);
      setInsertSuccess(true);
      setTimeout(() => setInsertSuccess(false), 2000);
    }
  };

  const handleCopy = () => {
    if (finalReport) {
      navigator.clipboard.writeText(finalReport);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  const handleExport = () => {
    if (finalReport) {
      const blob = new Blob([finalReport], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'committee_report.txt';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">ระบบจัดทำรายงานกรรมาธิการ</h2>
              <p className="text-sm text-gray-500">ถอดเสียงและจัดรูปแบบตาม Master SOP อัตโนมัติ</p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Left Column: Inputs */}
            <div className="space-y-6">
              {/* Audio Upload or Manual Text */}
              <div>
                <div className="flex items-center justify-between mb-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <label className="text-sm font-medium text-gray-700">
                    1. แหล่งข้อมูล
                  </label>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium ${!isManualRawText ? 'text-blue-600' : 'text-gray-500'}`}>ไฟล์เสียง</span>
                    <button
                      type="button"
                      onClick={() => setIsManualRawText(!isManualRawText)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isManualRawText ? 'bg-blue-600' : 'bg-gray-300'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isManualRawText ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                    <span className={`text-xs font-medium ${isManualRawText ? 'text-blue-600' : 'text-gray-500'}`}>ข้อความดิบ</span>
                  </div>
                </div>

                {!isManualRawText ? (
                  <>
                    <input 
                      type="file" 
                      accept="audio/*" 
                      className="hidden" 
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                    />
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors
                        ${audioFile ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}
                      `}
                    >
                      {audioFile ? (
                        <div className="flex flex-col items-center gap-2">
                          <FileAudio className="text-blue-500" size={32} />
                          <span className="text-sm font-medium text-blue-700">{audioFile.name}</span>
                          <span className="text-xs text-blue-500">{(audioFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-gray-500">
                          <Upload size={32} className="text-gray-400" />
                          <span className="text-sm font-medium">คลิกเพื่อเลือกไฟล์เสียง</span>
                          <span className="text-xs text-gray-400">รองรับไฟล์ขนาดใหญ่ (สูงสุด 2GB)</span>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <textarea
                    value={manualRawText}
                    onChange={(e) => setManualRawText(e.target.value)}
                    placeholder="วางข้อความดิบที่ถอดความมาแล้วที่นี่..."
                    className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-sm font-mono"
                  />
                )}
              </div>

              {/* Speaker List & Metadata */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  2. ข้อมูลเบื้องต้นและรายชื่อผู้พูด
                </label>
                <textarea
                  value={speakerList}
                  onChange={(e) => setSpeakerList(e.target.value)}
                  placeholder="ชื่อคณะ : อนุฯ ดิจิทัล (เทคโนโลยี)\nวันที่จด : ๑๘ กุมภาพันธ์ ๒๕๖๙\nผู้จด : นนทศักดิ์\n\n[รายชื่อ]\nประธาน   :   สวัสดีครับทุกท่าน\nนายสมชาย  รักงาน   :   ผมขอเสนอเรื่อง"
                  className="w-full h-48 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-sm font-mono"
                />
              </div>

              {/* Generate Button */}
              <button
                onClick={handleGenerate}
                disabled={status === 'UPLOADING' || status === 'TRANSCRIBING' || status === 'EDITING'}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg font-medium shadow-sm transition-colors flex items-center justify-center gap-2"
              >
                {(status === 'UPLOADING' || status === 'TRANSCRIBING' || status === 'EDITING') ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    {progressText}
                  </>
                ) : (
                  <>
                    <FileText size={18} />
                    เริ่มจัดทำรายงาน
                  </>
                )}
              </button>

              {/* Error Message */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-700 text-sm">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <p>{error}</p>
                </div>
              )}
            </div>

            {/* Right Column: Output */}
            <div className="flex flex-col h-full border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
              <div className="px-4 py-2 bg-gray-100 border-b border-gray-200 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">ผลลัพธ์รายงาน</span>
                {status === 'COMPLETE' && (
                  <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-100 px-2 py-1 rounded-full">
                    <CheckCircle2 size={12} />
                    เสร็จสมบูรณ์
                  </span>
                )}
              </div>
              
              <div className="flex-1 p-4 relative flex flex-col">
                {status === 'IDLE' && !finalReport && (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm text-center p-6">
                    อัปโหลดไฟล์เสียงและใส่รายชื่อผู้พูด<br/>จากนั้นกด "เริ่มจัดทำรายงาน"
                  </div>
                )}
                
                {(status === 'UPLOADING' || status === 'TRANSCRIBING' || (status === 'EDITING' && !finalReport)) && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-10">
                    <Loader2 size={32} className="text-blue-500 animate-spin mb-4" />
                    <p className="text-sm font-medium text-gray-700 mb-1">{progressText}</p>
                    <p className="text-xs text-gray-500">
                      {status === 'TRANSCRIBING' && 'กำลังถอดความดิบ 100% (The Transcriber)'}
                      {status === 'EDITING' && 'กำลังจัดรูปแบบตาม Master SOP (The Proxy Editor)'}
                    </p>
                  </div>
                )}

                {status === 'EDITING' && finalReport && (
                  <div className="absolute top-0 left-0 right-0 bg-blue-50/90 backdrop-blur border-b border-blue-100 p-2 flex items-center justify-center gap-2 z-10">
                    <Loader2 size={14} className="text-blue-500 animate-spin" />
                    <span className="text-xs font-medium text-blue-700">{progressText}</span>
                  </div>
                )}

                {rawTranscription && (
                  <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                    <div className="bg-gray-100 px-3 py-2 flex items-center justify-between cursor-pointer" onClick={() => setShowRawText(!showRawText)}>
                      <span className="text-xs font-medium text-gray-600 flex items-center gap-2">
                        {showRawText ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        ข้อความดิบ (Raw Text)
                      </span>
                      {showRawText && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(rawTranscription);
                            setCopySuccess(true);
                            setTimeout(() => setCopySuccess(false), 2000);
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                          <Copy size={12} /> คัดลอก
                        </button>
                      )}
                    </div>
                    {showRawText && (
                      <textarea
                        readOnly
                        value={rawTranscription}
                        className="w-full h-24 bg-gray-50 p-2 text-xs font-mono resize-none focus:outline-none border-t border-gray-200 text-gray-600"
                      />
                    )}
                  </div>
                )}

                {finalReport && (
                  <textarea
                    readOnly
                    value={finalReport}
                    className="flex-1 w-full bg-white border border-gray-200 rounded-lg p-3 text-sm font-mono resize-none focus:outline-none"
                  />
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 bg-gray-100 rounded-lg transition-colors"
          >
            ปิดหน้าต่าง
          </button>
          
          <div className="flex gap-3">
            <button
              onClick={handleExport}
              disabled={!finalReport}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 rounded-lg transition-colors flex items-center gap-2"
            >
              <Download size={16} />
              ส่งออกเป็นไฟล์ (.txt)
            </button>
            <button
              onClick={handleCopy}
              disabled={!finalReport}
              className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors flex items-center gap-2 ${
                copySuccess ? 'bg-green-500 hover:bg-green-600' : 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300'
              }`}
            >
              {copySuccess ? <Check size={16} /> : <Copy size={16} />}
              {copySuccess ? 'คัดลอกแล้ว' : 'คัดลอกข้อความ'}
            </button>
            <button
              onClick={handleInsert}
              disabled={!finalReport}
              className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors flex items-center gap-2 ${
                insertSuccess ? 'bg-green-500 hover:bg-green-600' : 'bg-green-600 hover:bg-green-700 disabled:bg-green-300'
              }`}
            >
              {insertSuccess ? <Check size={16} /> : <FileText size={16} />}
              {insertSuccess ? 'แทรกแล้ว' : 'แทรกข้อความลงพื้นที่ทำงาน'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
