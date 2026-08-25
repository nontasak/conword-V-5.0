
export function getBestMatches(ocrText: string, speakerList: string[], topN: number = 3): string[] {
  // Clean OCR text: remove spaces, punctuation, and convert to lower case
  const cleanText = ocrText.replace(/[\s\.\,\:\;\-\_]/g, '').toLowerCase();
  if (!cleanText) return [];

  const validSpeakers = speakerList.filter(s => s.trim() !== '');

  const scored = validSpeakers.map(speaker => {
    const cleanSpeaker = speaker.replace(/[\s\.\,\:\;\-\_]/g, '').toLowerCase();
    if (!cleanSpeaker) return { speaker, score: 999, cleanSpeakerLength: 0 };
    
    // Simple inclusion check first
    if (cleanText.includes(cleanSpeaker) || cleanSpeaker.includes(cleanText)) {
      return { speaker, score: 0, cleanSpeakerLength: cleanSpeaker.length }; // Perfect/substring match
    }
    
    // Levenshtein distance
    const dist = levenshtein(cleanText, cleanSpeaker);
    return { speaker, score: dist, cleanSpeakerLength: cleanSpeaker.length };
  });

  // Filter out terrible matches (e.g. distance > half the length of the speaker name)
  const filtered = scored.filter(s => s.score === 0 || s.score <= Math.max(3, s.cleanSpeakerLength * 0.6));

  filtered.sort((a, b) => a.score - b.score);
  
  // Ensure unique predictions
  const uniqueMatches = Array.from(new Set(filtered.map(s => s.speaker)));
  return uniqueMatches.slice(0, topN);
}

export function levenshtein(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

export function calculateSimilarity(text1: string, text2: string): number {
  // Common Thai titles to ignore for similarity comparison
  const titles = ['นาย', 'นางสาว', 'นาง', 'ท่าน', 'ส.ส.', 'ส.ว.', 'พล.อ.', 'พล.ท.', 'พล.ต.', 'พ.อ.', 'พ.ท.', 'พ.ต.', 'ร.อ.', 'ร.ท.', 'ร.ต.'];
  
  let clean1 = text1.replace(/[\s\.\,\:\;\-\_]/g, '').toLowerCase();
  let clean2 = text2.replace(/[\s\.\,\:\;\-\_]/g, '').toLowerCase();
  
  // Remove titles from both strings for a more accurate name comparison
  titles.forEach(title => {
    const cleanTitle = title.replace(/[\s\.]/g, '').toLowerCase();
    clean1 = clean1.replace(new RegExp('^' + cleanTitle), '');
    clean2 = clean2.replace(new RegExp('^' + cleanTitle), '');
  });
  
  if (!clean1 || !clean2) return 0;
  if (clean1 === clean2) return 1.0;
  
  // If one is a substring of another, it's a very strong match
  if (clean1.includes(clean2) || clean2.includes(clean1)) {
    // We can return 1.0 or something very high like 0.95
    return 0.95; 
  }
  
  const dist = levenshtein(clean1, clean2);
  const maxLen = Math.max(clean1.length, clean2.length);
  return 1 - (dist / maxLen);
}

export const arabicNumberToThaiNumberAndReplace = (text: string): string => {
  let newText = performAdditionalReplacements(text);

  const arabicNumber = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const thaiNumber = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙'];

  // แก้ไขปีย่อเป็นปีเต็ม
  newText = newText.replace(/(มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม) (\d{2})(?=\D|$)/g, '$1 ๒๕$2');
  newText = newText.replace(/ปี (\d{2})(?=\D|$)/g, 'ปี ๒๕$1');

  // เปลี่ยนเวลาที่มีรูปแบบ xx:xx น เป็น xx.xx นาฬิกา
  newText = newText.replace(/(\d{2}):(\d{2}) น/g, "$1.$2 นาฬิกา");

  // ลบคำที่พิมพ์ซ้ำ
  newText = newText.replace(/นำ(นำ)+/g, 'นำ');
  newText = newText.replace(/เรื่อง(เรื่อง)+/g, 'เรื่อง');
  newText = newText.replace(/ทำ(ทำ)+/g, 'ทำ');
  newText = newText.replace(/ว่า(ว่า)+/g, 'ว่า');
  newText = newText.replace(/คือ(คือ)+/g, 'คือ');
  newText = newText.replace(/ซึ่ง(ซึ่ง)+/g, 'ซึ่ง');
  newText = newText.replace(/ท่าน(ท่าน)+/g, 'ท่าน');
  newText = newText.replace(/มี(มี)+/g, 'มี');
  newText = newText.replace(/ได้(ได้)+/g, 'ได้');
  newText = newText.replace(/ไม่(ไม่)+/g, 'ไม่');
  newText = newText.replace(/ผม(ผม)+/g, 'ผม');
  newText = newText.replace(/อันนี้(อันนี้)+/g, 'อันนี้');
  newText = newText.replace(/ไป(ไป)+/g, 'ไป');
  newText = newText.replace(/นุการ(นุการ)+/g, 'นุการ');
  newText = newText.replace(/เป็น(เป็น)+/g, 'เป็น');
  newText = newText.replace(/ของ(ของ)+/g, 'ของ');
  newText = newText.replace(/ไม่ได้(ไม่ได้)+/g, 'ไม่ได้');
  newText = newText.replace(/ๆ(ๆ)+/g, 'ๆ');
  newText = newText.replace(/\.\s\.\s\.\s/g, '. ');
  newText = newText.replace(/หน้าที่\s+(\d+)/g, 'หน้า $1');


  // แปลงตัวเลขอารบิกเป็นตัวเลขไทย
  for (let i = 0; i < newText.length; i++) {
    const char = newText.charAt(i);
    const index = arabicNumber.indexOf(char);
    if (index !== -1) {
      newText = newText.replace(char, thaiNumber[index]);
    }
  }

  // แก้คำผิดและลบคำตามเงื่อนไขที่กำหนด
  const replacements = [
    { pattern: /สภาผู้แทน(?!ราษฎร)/g, newText: "สภาผู้แทนราษฎร" },
    { pattern: /ทูลเกล้า(?!ฯ)/g, newText: "ทูลเกล้าฯ" },
    { pattern: /กระทรวงเกษตร(?!และสหกรณ์)/g, newText: "กระทรวงเกษตรและสหกรณ์" },
    { pattern: /เพราะฉะนั้น(?! )/g, newText: "เพราะฉะนั้น " },
    { pattern: /ล้านล้าน(?!บาท)/g, newText: "ล้านล้านบาท" },
    { pattern: /สหรัฐ(?!อเมริกา)/g, newText: "สหรัฐอเมริกา" },
    { pattern: /มัธยม(?!ศึกษา)/g, newText: "มัธยมศึกษา" },
    { pattern: /พฤหัส(?!บดี)/g, newText: "พฤหัสบดี" },
    { pattern: /จังหวัดสกล(?!นคร)/g, newText: "สกลนคร" },
    { pattern: /จังหวัดอุบล(?!ราชธานี)/g, newText: "อุบลราชธานี" },


    { pattern: /(?<!น้ำ|อันดา|ไข|เยอร)มัน(?!ฝรั่ง|สำปะหลัง|เทศ|แกว)/g, newText: "" },
    { pattern: /ก็(?!บ|ต|ง|จ|ด)/g, newText: "" },
    { pattern: /เ\*+วชาญ/g, newText: "เชี่ยวชาญ" },
    { pattern: /แ\*+าน/g, newText: "แม่งาน" },

    //ถ้า (... ไม่ตามด้วย ... จะแก้) |หาคำนี้|หาคำนี้| ถ้าเจอจะแก้
    { pattern: /กรุงเทพ(?!มหานคร)|กรุงเทพฯ|กรุงเทพมหานครฯ/g, newText: "กรุงเทพมหานคร" },

    // เติมช่องว่าง
    { pattern: /-(?! )/g, newText: " - " },
    { pattern: /ๆ(?! )/g, newText: " ๆ " },
    { pattern: /อปท.(?! )/g, newText: " อปท. " },

    // ถ้า....ไม่มี(?!...ต่อท้าย จะแก้ข้อความ แต่ถ้ามี ...|... ) จะไม่แก้ข้อความ *********
    { pattern: /ล้าน(?!บาท|ค|ล|ต|ไ)/g, newText: "ล้านบาท" },

    //ถ้า     ไม่มี ห นำหน้า กรรมการ ไม่มี การอาชีวศึกษา.....ต่อท้าย จะแก้กรรมการเป็น กรรมาธิการ **ถ้าจะเพิ่่มคำข้างหน้าให้ใส่ | ได้ **
    //*******************************************************************
    //***************************กรรมการ*********************************
    { pattern: /(?<!ห|จ)กรรมการ(?!ก|ป| |ต|ส|ร|น|ด|พ|บ|ม|ค|จ|องค์กรอิสระ)/g, newText: "กรรมาธิการ" },
    //*******************************************************************
    { pattern: /เลขา(?!นุการ|ธิการ)/g, newText: "เลขานุการ" },
    { pattern: /(?<!หม่อน)ไหม(?!ทอง|พรม|้)/g, newText: "หรือไม่" },
    //{ pattern: /(?<!ป)นายก(?!รัฐมนตรี|อ|เ| |ส|ค|ศ|ิ)/g, newText: "นายกรัฐมนตรี" },


    //เติมจุด***********************************************
    { pattern: /สตง(?!\.)/g, newText: " สตง. " },
    { pattern: /(\b)พ\.ร\.บ(?!\.)/g, newText: "$1พ.ร.บ. " },
    { pattern: /กกต(?!\.|ิกา)/g, newText: " กกต." },
    { pattern: /อปท(?!\.)/g, newText: " อปท. " },
    { pattern: /คสช(?!\.)/g, newText: " คสช. " },
    { pattern: /กสทช(?!\.)/g, newText: " กสทช. " },
    { pattern: /กศน(?!\.)/g, newText: " กศน. " },
    { pattern: /ครม(?!\.|ี|า)/g, newText: " ครม. " },
    { pattern: /ค.ร.ม(?!\.|ี|า)/g, newText: " ครม. " },
    { pattern: /พรบ(?!\.)/g, newText: " พ.ร.บ. " },
    { pattern: /ปปง(?!\.)/g, newText: " ปปง. " },
    { pattern: /ปปช(?!\.)/g, newText: " ป.ป.ช. " },
    { pattern: /ป.ป.ช(?!\.)/g, newText: " ป.ป.ช. " },
    { pattern: /ปปท(?!\.)/g, newText: " ป.ป.ท. " },
    { pattern: /สวทช(?!\.)/g, newText: " สวทช. " },

    //ลบช่องว่างที่มากกว่า 1 เคาะ จะต้องอยู่ล่างสุดเสมอ ****************
    { pattern: /(?:\r\n?|\n){2,}/g, newText: "\n" },
  ];

  replacements.forEach(function (replacement) {
    newText = newText.replace(replacement.pattern, replacement.newText);
  });

  return newText;
}

export const processPlusSigns = (text: string): string => {
  // หาคำที่มีเครื่องหมาย "+"
  let newText = text.replace(/\+/g, "\n\t\t");

  // ลบเคาะบรรทัดใหม่เมื่อมีบรรทัดว่างหลายบรรทัดซ้อนๆ กัน
  newText = newText.replace(/(?:\r\n?|\n){2,}/g, "\n");

  return newText;
}

function performAdditionalReplacements(text: string): string {
  let newText = text;
  newText = newText.replace(/ฮะ/g, "");
  newText = newText.replace(/นะครับ/g, "");
  newText = newText.replace(/เนาะ/g, "");
  newText = newText.replace(/มั้ย/g, "");
  newText = newText.replace(/ครับ/g, "");
  newText = newText.replace(/นะคะ/g, "");
  newText = newText.replace(/ค่ะ/g, "");
  newText = newText.replace(/เนี่ย/g, "");
  newText = newText.replace(/เนี้ย/g, "");
  newText = newText.replace(/ไอ้/g, "");
  newText = newText.replace(/น่ะ/g, "");
  newText = newText.replace(/อ่ะ/g, "");
  newText = newText.replace(/เนี่ย/g, "");
  newText = newText.replace(/เงี้ย/g, "");
  newText = newText.replace(/นะฮะ/g, "");
  newText = newText.replace(/ฮ่า/g, "");
  newText = newText.replace(/แว๊บ ๆ /g, "");
  newText = newText.replace(/เอ้ย/g, "");
  newText = newText.replace(/โอ้โห/g, "");
  newText = newText.replace(/เนี่ย/g, "");
  newText = newText.replace(/เอ้า/g, "");
  newText = newText.replace(/เออ/g, "");
  newText = newText.replace(/นี่แหละ/g, "");
  newText = newText.replace(/อยู่นะ/g, "");
  newText = newText.replace(/ตามนั้น/g, "");
  newText = newText.replace(/ก็แล้วแต่/g, "");
  newText = newText.replace(/นู้น/g, "");
  newText = newText.replace(/นี่ก็/g, "");
  newText = newText.replace(/อะไรนะ/g, "");
  newText = newText.replace(/นั่นแหละ/g, "");
  newText = newText.replace(/เอ้ย/g, "");
  newText = newText.replace(/เอ่อ/g, "");
  newText = newText.replace(/ตัวของ/g, "");
  newText = newText.replace(/ที่ด่าน/g, "");
  newText = newText.replace(/ นั้น/g, "");
  newText = newText.replace(/ป๋า/g, "");
  newText = newText.replace(/นี้จะ/g, "");
  newText = newText.replace(/ก็เลย/g, "");
  newText = newText.replace(/ขอสไลด์ต่อไป/g, "");
  newText = newText.replace(/สไลด์ต่อไป/g, "");
  newText = newText.replace(/ปุ๊บ/g, "");
  newText = newText.replace(/แหละ/g, "");
  newText = newText.replace(/ป่ะ/g, "");
  newText = newText.replace(/มั้ง/g, "");
  newText = newText.replace(/ใช่ป่ะ/g, "");
  newText = newText.replace(/ด้วยป่ะ/g, "");
  newText = newText.replace(/อะไรอย่างงี้/g, "");
  newText = newText.replace(/อะไรอย่างนี้/g, "");
  newText = newText.replace(/อินดี้/g, "");
  newText = newText.replace(/อ่าก็/g, "");
  newText = newText.replace(/นาฬิกาะ/g, "");
  newText = newText.replace(/แล้วกัน/g, "");
  newText = newText.replace(/ป๋อง/g, "");
  newText = newText.replace(/เอาไง/g, "");



  //แก้คำให้ถูกต้อง ******************************************
  newText = newText.replace(/กดระเบียบ/g, "กฎระเบียบ");
  newText = newText.replace(/ท่านประทาน/g, "ท่านประธาน");
  newText = newText.replace(/โควต้า/g, "โควตา");
  newText = newText.replace(/อาทิตย์หน้า/g, "สัปดาห์หน้า");
  newText = newText.replace(/อาทิตย์ต่อ/g, "สัปดาห์ต่อ");
  newText = newText.replace(/อายุอเมริกา/g, "อนุกรรมาธิการ");
  newText = newText.replace(/มนุษย์ชน/g, "มนุษยชน");
  newText = newText.replace(/ค่อนข้างเยอะ/g, "ค่อนข้างมาก");
  newText = newText.replace(/รถค่า/g, "ลดค่า");
  newText = newText.replace(/แจ้งจากที่/g, "แจ้งต่อที่");
  newText = newText.replace(/ระเบียบเวลา/g, "ระเบียบวาระ");
  newText = newText.replace(/เชิงมา/g, "เชิญมา");
  newText = newText.replace(/ประกันที่/g, "ประการที่");
  newText = newText.replace(/เครือขาด/g, "เครือข่าย");
  newText = newText.replace(/สำนักงานประมาณ/g, "สำนักงบประมาณ");
  newText = newText.replace(/ต่อสนอง/g, "ตอบสนอง");
  newText = newText.replace(/พี่นา/g, "พิจารณา");
  newText = newText.replace(/รูปประธรรม/g, "รูปธรรม");
  newText = newText.replace(/ทั้งสองฝ่าย/g, "ทั้ง ๒ ฝ่าย");
  newText = newText.replace(/นึง/g, "หนึ่ง");
  newText = newText.replace(/งั้น/g, "อย่างนั้น");
  newText = newText.replace(/ไหร่/g, "ไร");
  newText = newText.replace(/เมื่อกี้/g, "เมื่อสักครู่นี้");
  newText = newText.replace(/คุรุภัณฑ์/g, "ครุภัณฑ์");
  newText = newText.replace(/ยังไง/g, "อย่างไร");
  newText = newText.replace(/มหาลัย/g, "มหาวิทยาลัย");
  newText = newText.replace(/%/g, "เปอร์เซ็นต์");
  newText = newText.replace(/นาฬิกาาที/g, "นาที");
  newText = newText.replace(/หรือเปล่า/g, "หรือไม่");
  newText = newText.replace(/นครประถม/g, "นครปฐม");
  newText = newText.replace(/ณวันที่/g, " ณ วันที่");
  newText = newText.replace(/ณขณะนี้/g, " ณ ขณะนี้");
  newText = newText.replace(/ณปัจจุบัน/g, " ณ ปัจจุบัน");
  newText = newText.replace(/ณวันนี้/g, " ณ วันนี้");
  newText = newText.replace(/โอเค/g, " โอเค ");
  newText = newText.replace(/LINE/g, "ไลน์");
  newText = newText.replace(/อนุกรรมการ/g, "อนุกรรมาธิการ");
  newText = newText.replace(/ในเรื่องของ/g, "ในเรื่อง");
  newText = newText.replace(/เดินทีเดียว/g, "เดิมทีเดียว");
  newText = newText.replace(/นั่นหมายความว่า/g, "หมายความว่า");
  newText = newText.replace(/ไว้นะ/g, "ไว้");
  newText = newText.replace(/หม่อนหรือไม่/g, "หม่อนไหม");
  newText = newText.replace(/อะไรอย่างไร/g, "อย่างไร");
  newText = newText.replace(/ก็น่าจะ/g, "น่าจะ");
  newText = newText.replace(/แบงค์/g, "ธนาคาร");
  newText = newText.replace(/แบงค์ชาติ/g, "ธนาคารแห่งประเทศไทย");
  newText = newText.replace(/ธนาคารชาติ/g, "ธนาคารแห่งประเทศไทย");
  newText = newText.replace(/ดิจิตอล/g, "ดิจิทัล");
  newText = newText.replace(/สรุปก็คือว่า/g, "สรุปว่า");
  newText = newText.replace(/ประมาณสัก/g, "ประมาณ");
  newText = newText.replace(/เท่านั้นเท่านี้/g, "เท่านี้");
  newText = newText.replace(/นั้นเป็น/g, "เป็น");
  newText = newText.replace(/2560 6/g, "2566");
  newText = newText.replace(/ก็ประมาณ/g, "ประมาณ");
  newText = newText.replace(/เรื่องของ/g, "เรื่อง");
  newText = newText.replace(/ที่ทาง/g, "ที่");
  newText = newText.replace(/เพื่อที่จะ/g, "เพื่อ");
  newText = newText.replace(/กับทาง/g, "กับ");
  newText = newText.replace(/ให้ทาง/g, "ให้");
  newText = newText.replace(/ดูซิ/g, "ดู");
  newText = newText.replace(/และทาง/g, "และ");
  newText = newText.replace(/ทางที่ประชุม/g, "ที่ประชุม");
  newText = newText.replace(/รถจาก/g, "ลดจาก");
  newText = newText.replace(/นัยยะสำคัญ/g, "นัยสำคัญ");
  newText = newText.replace(/ประชุมวิทย์/g, "ประชุมวิป");
  newText = newText.replace(/เดี๋ยวต้อง/g, "ต้อง");
  newText = newText.replace(/ทางผู้แทน/g, "ผู้แทน");
  newText = newText.replace(/ผมว่า/g, "ผมคิดว่า");
  newText = newText.replace(/ไม่จะเป็น/g, "ไม่ว่าจะเป็น");
  newText = newText.replace(/เลยทำให้/g, "จึงทำให้");
  newText = newText.replace(/คำหนึ่ง/g, "คำนึง");
  newText = newText.replace(/เค้า/g, "เขา");
  newText = newText.replace(/เพราะอย่างนั้น/g, "เพราะฉะนั้น");
  newText = newText.replace(/หน่อย/g, "");
  newText = newText.replace(/ลายน้ำอนุ/g, "รายนามอนุ");
  newText = newText.replace(/ลายน้ำกรรม/g, "รายนามกรรม");
  newText = newText.replace(/ผู้รายการประชุม /g, "ผู้ลาการประชุม");
  newText = newText.replace(/สาสุข/g, "สาธารณสุข");
  newText = newText.replace(/หน้าจะ/g, "น่าจะ");
  newText = newText.replace(/นวัตกรรมาธิการ/g, "นวัตกรรมการ");
  newText = newText.replace(/ระบบขนส่งมวลชนกรุงเทพมหานคร/g, "ระบบขนส่งมวลชนกรุงเทพ");
  newText = newText.replace(/คนแก่/g, "ผู้สูงอายุ");
  newText = newText.replace(/เยอะขึ้น/g, "มากขึ้น");
  newText = newText.replace(/ร่วงเลย/g, "ล่วงเลย");
  newText = newText.replace(/อย่างงี้/g, "อย่างนี้");
  newText = newText.replace(/คิดนะ/g, "คิด");
  newText = newText.replace(/ออนไซด์/g, "ออนไซต์");
  newText = newText.replace(/ดีเลย/g, "ดี");
  newText = newText.replace(/นาฬิกาาที/g, "นาที");
  newText = newText.replace(/พละศึกษา/g, "พลศึกษา");
  newText = newText.replace(/และใช้ได้ดีเลย/g, "แล้วใช้ได้ดี");
  newText = newText.replace(/สวัสดีถ้าเราไม่ขัดข้อง/g, "วันนี้ถ้าเราไม่ขัดข้อง");
  newText = newText.replace(/เมื่อสักครู่นี้นะ/g, "เมื่อสักครู่นี้");
  newText = newText.replace(/อยากสัปดาห์วันพุธพรุ่งนี้/g, "วันพรุ่งนี้");
  newText = newText.replace(/คณะกรรมาธิการคณะใหญ่เขา/g, "คณะกรรมาธิการคณะใหญ่");
  newText = newText.replace(/แล้วนะ/g, "แล้ว");
  newText = newText.replace(/แจ้งมาเพิ่มเติมมา/g, "แจ้งเพิ่มเติมมา");
  newText = newText.replace(/ผมเชื่อเป็น/g, "ผมเชื่อว่าเป็น");
  newText = newText.replace(/อยากให้ถ้าเรา/g, "ถ้าเรา");
  newText = newText.replace(/อยากจะให้/g, "อยากให้");
  newText = newText.replace(/อย่างนั้นผมขอ/g, "ผมขอ");
  newText = newText.replace(/จะคณะเรา/g, "จากคณะเรา");
  newText = newText.replace(/ตามที่ตามที่/g, "ตามที่");
  newText = newText.replace(/ระเบียบวาระที่ ๒ รับรองผู้จัดการประชุม/g, "ระเบียบวาระที่ ๒ รับรองบันทึกการประชุม");
  newText = newText.replace(/ฝ่ายเลขานุการเขา/g, "ฝ่ายเลขานุการ");
  newText = newText.replace(/หน้าด้านอนุ/g, "หน้าแรกอนุ");
  newText = newText.replace(/กรรมการอาชีวศึกษา /g, "กรรมการการอาชีวศึกษา ");
  newText = newText.replace(/เพิ่มเติมอะไรหรือไม่/g, "เพิ่มเติมหรือไม่");
  newText = newText.replace(/เป้าหมายณสิ้น/g, "เป้าหมาย ณ สิ้น");
  newText = newText.replace(/ต้องมีเสนอ/g, "ต้องเสนอ");
  newText = newText.replace(/การที่เกิด/g, "การเกิด");
  newText = newText.replace(/กระทรวงท่องเที่ยวและกีฬา/g, "กระทรวงการท่องเที่ยวและกีฬา");
  newText = newText.replace(/แม่สอดคล้อง/g, "ไม่สอดคล้อง");
  newText = newText.replace(/ปัญหาลูกประสาท/g, "ปัญหาและอุปสรรค");
  newText = newText.replace(/ข้อเขียนเพิ่มเติม/g, "ข้อคิดเห็นเพิ่มเติม");
  newText = newText.replace(/เกี่ยวการ/g, "เกี่ยวกับการ");
  newText = newText.replace(/e-bidding/g, "e-Bidding");
  newText = newText.replace(/blockchain/g, "Blockchain");
  newText = newText.replace(/ล็อค/g, "ล็อก");
  newText = newText.replace(/ขอบคุณนะ/g, "ขอบคุณ");
  newText = newText.replace(/กันมาที่การ/g, "กรรมาธิการ");
  newText = newText.replace(/กรรมาธิการตำรวจ/g, "กรรมาธิการการกฎหมาย การยุติธรรม และการตำรวจ");
  newText = newText.replace(/คณะมนตรี/g, "คณะรัฐมนตรี");
  newText = newText.replace(/ได้ไง/g, "ได้อย่างไร");
  newText = newText.replace(/ด็อกเตอร์/g, "ดอกเตอร์");
  newText = newText.replace(/Application/g, "แอปพลิเคชัน");
  newText = newText.replace(/แอปพลิเคชั่น/g, "แอปพลิเคชัน");
  newText = newText.replace(/คอร์รัปชั่น/g, "คอร์รัปชัน");
  newText = newText.replace(/คอรัปชั่น/g, "คอร์รัปชัน");
  newText = newText.replace(/App/g, "app");
  newText = newText.replace(/00,000/g, " แสน");
  newText = newText.replace(/000,000/g, " ล้าน");
  newText = newText.replace(/เยอรมัน/g, "เยอรมนี");
  newText = newText.replace(/เอกสารสิทธิ์/g, "เอกสารสิทธิ");
  newText = newText.replace(/สิทธิ์ม/g, "สิทธิม");
  newText = newText.replace(/สิทธิขาด/g, "สิทธิ์ขาด");
  newText = newText.replace(/ลิขสิทธิ/g, "ลิขสิทธิ์");
  newText = newText.replace(/กรรมสิทธิ/g, "กรรมสิทธิ์");
  newText = newText.replace(/สงวนสิทธิ/g, "สงวนสิทธิ์");
  newText = newText.replace(/สละสิทธิ/g, "สละสิทธิ์");
  newText = newText.replace(/ศักดิ์สิทธิ/g, "ศักดิ์สิทธิ์");
  newText = newText.replace(/ไงบ้าง/g, "อย่างไรบ้าง");
  newText = newText.replace(/เป็นไง/g, "เป็นอย่างไร");
  newText = newText.replace(/พร้อมเพียง/g, "พร้อมเพรียง");
  newText = newText.replace(/ค่าลด/g, "ค่ารถ");
  newText = newText.replace(/ {3}: {4}/g, "   :   ");

  //สิ้นสุดช่วงแก้ไขคำ 

  // เปลี่ยน " น " เป็น " นาฬิกา "
  newText = newText.replace(/(\d{2}):(\d{2})\s+น\s+/g, "$1.$2 นาฬิกา ");

  return newText;
}

export const findAndAlertErrors = (text: string): string => {
  const searchTexts = [
    "ตามาตรา", "มีมี", "จเรณักณิ์", "บชก.", "แยกยะ", "สุดอันท้าย", "กลไกล", "กำหราบ", "สุโขทั่ว", "ส่งข้าว", "บังคับบัญชี",
    "๒๕๒๕๖๕", "สวรรณี", "ครับครับ", "หน่วนงาน", "พรก.", "พรป.", "ประโต", "แลกหน้า", "ชั่งสังเกต", "ป.ป.ง.",
    "เราได้เราได้", "ภูธรณ์", "พาณิชย์นาวี", "ทรุดโซม", "เสื่อมโซม", "องค์การปกครองส่วนท้องถิ่น", "กระทรวงพัฒนาสังคมและความมั่นคงของมนุษย์", "ช่อโกง", "องค์กรบริหารส่วนตำบล", "วิพากย์วิจารณ์", "อิสระภาพ", "ประทะ", "อนุญาติ", "ญาตพี่น้อง", "ใต้ฝุ่น", "กงศุล", "กระทันหัน", "กระเหรี่ยง", "กระโหลก", "กระลา", "กำเน็จ", "เกษียน", "เกษียร", "ประชาชา", "จบคน", "กราบของพระคุณ", "ของพระคุณ", "ตามา", "แบตเตอร์รี่", "จากองทุน", "ศรัทรา", "ศัทรา", "กิตมศักดิ์", "วีดีโอ", "วีดิโอ", "วีดีทัศน์", "วิดีทัศน์", "เสมอภาพ", "เฮลธ์ตี", "เรือยอร์ช", "ไซซ์", "สแตนบาย", "โควิด-๑๙", "โควิด - ๑๙", "เอกเซลเลนต์", "แมพปิง", "เรคคอร์ด", "รอบครอบ", "กู๊ดกัฟเวอร์นแนนซ์", "ซิสเตม", "ซอฟต์เพาเวอร์", "ผู้ดำรำ", "อุทร", "ศาลอุทร", "ปริญาโท", "ภาวะการณ์", "ธกส.", "หาเรือ", "ปีจำปี", "จะจังต่อ", "อนุมาตรา ๑๐", "อนุมาตรา", "คุณธรรท", "ประบวนการ", "รองทุกข์", "วินิจใน", "เสาร์", "อกนาจ", "รุสันดาป", "มาตรม", "โดยเฉพาะยิ่ง", "สำนักงานวัตกรรม", "วุฒิสมาชิก", "คามเห็น", "ร่วงม", "กับกับ", "สำนักงานวัตกรรม", "ชัชวาล", "iRaw", "ผิงฝา", "ขออง", "หมาดไทย", "ยึดหยุ่น", "มากน้อง", "ยาวนา", "อ่อนแอยู่", "is of doing", "หลบหลี", "เกิดขั้น", "สำนักงานวุฒิสภา", "เวรคืน", "ความท้าท้าย", "สาธารณะชน", "เรื่องเรื่อง", "เอาไง", "ยังไง", "อย่างงั้น", "อย่างงี้", "เยอรมัน", "ล็อค", "อิสราอีก", "เจาจะ", "ท่านท่าน", "ล่วงน่า"
  ];

  const suggestions: { [key: string]: string } = {
    "ตามาตรา": "ตามมาตรา", "จเรณักณิ์": "จเรศักณิ์", "บชก.": "บช.ก.", "แยกยะ": "แยกแยะ", "กลไกล": "กลไก", "กำหราบ": "กำราบ", "สวรรณี": "สุวรรณี",
    "พรก.": "พ.ร.ก.", "พรป.": "พ.ร.ป.", "ชั่งสังเกต": "ช่างสังเกต", "ป.ป.ง.": "ปปง.", "ช่อโกง": "ฉ้อโกง", "ภูธรณ์": "ภูธร", "พาณิชย์นาวี": "พาณิชยนาวี", "ทรุดโซม": "ทรุดโทรม", "เสื่อมโซม": "เสื่อมโทรม", "องค์การปกครองส่วนท้องถิ่น": "องค์กรปกครองส่วนท้องถิ่น", "กระทรวงพัฒนาสังคมและความมั่นคงของมนุษย์": "กระทรวงการพัฒนาสังคมและความมั่นคงของมนุษย์", "องค์กรบริหารส่วนตำบล": "องค์การบริหารส่วนตำบล", "วิพากย์วิจารณ์": "วิพากษ์วิจารณ์", "อิสระภาพ": "อิสรภาพ", "ประทะ": "ปะทะ", "อนุญาติ": "อนุญาต", "ญาตพี่น้อง": "ญาติพี่น้อง", "ใต้ฝุ่น": "ไต้ฝุ่น", "กงศุล": "กงสุล", "กระทันหัน": "กะทันหัน", "กระเหรี่ยง": "กะเหรี่ยง", "กระโหลก": "กะโหลก", "กระลา": "กะลา", "กำเน็จ": "กำเหน็จ", "เกษียน": "เกษียณ", "เกษียร": "เกษียณ", "แบตเตอร์รี่": "แบตเตอรี่", "ศรัทรา": "ศรัทธา", "ศัทรา": "ศรัทธา", "กิตมศักดิ์": "กิตติมศักดิ์", "วีดีโอ": "วิดีโอ", "วีดิโอ": "วิดีโอ", "วีดีทัศน์": "วีดิทัศน์", "วิดีทัศน์": "วีดิทัศน์", "เสมอภาพ": "เสมอภาค", "เฮลธ์ตี": "เฮลท์ตี", "เรือยอร์ช": "เรือยอชต์", "ไซซ์": "ไซส์", "สแตนบาย": "สแตนด์บาย", "โควิด-๑๙": "โควิด-19", "เอกเซลเลนต์": "เอ็กเซลเลนต์", "แมพปิง": "แมปปิง", "เรคคอร์ด": "เรกคอร์ด", "รอบครอบ": "รอบคอบ", "กู๊ดกัฟเวอร์นแนนซ์": "กู๊ดกัฟเวอร์แนนซ์", "ซิสเตม": "ซิสเต็ม", "ซอฟต์เพาเวอร์": "ซอฟต์พาวเวอร์", "ผู้ดำรำ": "ผู้ดำรง", "อุทร": "อุทธรณ์ (อุทรเฉย ๆ แปลว่าท้อง)", "ศาลอุทร": "ศาลอุทธรณ์", "ภาวะการณ์": "ภาวการณ์", "ธกส.": "ธ.ก.ส.", "หาเรือ": "หาเรือ หรือหารือ", "ปีจำปี": "ประจำปี หรือเปล่า", "จะจังต่อ": "จะแจ้งต่อ", "อนุมาตรา ๑๐": "(๑๐)", "อนุมาตรา": "อาจจะเป็นวงเล็บ", "เสาร์": "วันเสาร์ หรือ เสาไฟ", "รุสันดาป": "รถสันดาป", "มาตรม": "มาตรา", "โดยเฉพาะยิ่ง": "โดยเฉพาะอย่างยิ่ง", "สำนักงานวัตกรรม": "สำนักงานนวัตกรรม", "วุฒิสมาชิก": "สมาชิกวุฒิสภา", "คามเห็น": "ความเห็น", "ร่วงม": "ร่วม", "กับกับ": "กับ", "ชัชวาล": "ชัชวาลย์", "iRaw": "iLaw", "ผิงฝา": "พิงฝา", "ขออง": "ของ", "หมาดไทย": "มหาดไทย", "ยึดหยุ่น": "ยืดหยุ่น", "มากน้อง": "มากน้อย", "ยาวนา": "ยาวนาน", "อ่อนแอยู่": "อ่อนแออยู่", "is of doing": "ease of doing", "หลบหลี": "หลบหนี", "เกิดขั้น": "เกิดขึ้น", "สำนักงานวุฒิสภา": "สำนักงานเลขาธิการวุฒิสภา", "เวรคืน": "เวนคืน", "ความท้าท้าย": "ความท้าทาย", "สาธารณะชน": "สาธารณชน", "เยอรมัน": "เยอรมนี", "ล็อค": "ล็อก", "อิสราอีก": "อิสราเอล", "เจาจะ": "เขาจะ", "ล่วงน่า": "ล่วงหน้า",
  };

  let foundKeywords: string[] = [];

  searchTexts.forEach(function (searchText) {
    const regex = new RegExp(searchText, "gi");
    if (text.match(regex)) {
      foundKeywords.push(searchText);
    }
  });

  let message = "พบคำผิดต่อไปนี้\n\n";

  if (foundKeywords.length > 0) {
    foundKeywords = foundKeywords.filter(function (keyword, index, self) {
      return self.indexOf(keyword) === index;
    });

    foundKeywords.forEach(function (keyword) {
      const errorCount = (text.match(new RegExp(keyword, "gi")) || []).length;
      const suggestion = suggestions[keyword] || "ปรับแก้ไข";
      message += "คำที่ผิด : " + keyword + " (" + errorCount + " แห่ง)\nคำแนะนำ : " + suggestion + "\n\n";
    });
  } else {
    message = "ไม่พบคำผิดในข้อความนี้";
  }

  return message;
}
