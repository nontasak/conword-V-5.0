import { senatorNames, loanwordMisspellingsDict } from './constants';

export interface RuleBasedResult {
  original: string;
  suggestion: string;
  reason: string;
}

const getLevenshteinDistance = (a: string, b: string): number => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
  for (let i = 0; i <= a.length; i += 1) { matrix[0][i] = i; }
  for (let j = 0; j <= b.length; j += 1) { matrix[j][0] = j; }
  for (let j = 1; j <= b.length; j += 1) {
    for (let i = 1; i <= a.length; i += 1) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // insertion
        matrix[j - 1][i] + 1, // deletion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }
  return matrix[b.length][a.length];
};

export const checkSpecificWords = (text: string): RuleBasedResult[] => {
  const results: RuleBasedResult[] = [];
  const lines = text.split('\\n');

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    // Check Senator names
    senatorNames.forEach(fullName => {
      const titles = [
        "ว่าที่พันตรี ", "พันตำรวจเอก ", "พลเอก ", "นางสาว", "นาย", "นาง", 
        "พลตำรวจตรี ", "ศาสตราจารย์", "ผู้ช่วยศาสตราจารย์พิเศษ", "ผู้ช่วยศาสตราจารย์", 
        "รองศาสตราจารย์", "ร้อยตำรวจเอก ", "พันเอกหญิง ", "พลตำรวจโท ", 
        "พันตำรวจโท ", "พลโท ", "นาวาตรี "
      ];
      let cleanFullName = fullName;
      for (const title of titles) {
        if (cleanFullName.startsWith(title)) {
          cleanFullName = cleanFullName.replace(title, '').trim();
          break;
        }
      }
      
      const parts = cleanFullName.split(' ');
      if (parts.length < 2) return;
      const firstName = parts[0];
      const surname = parts.slice(1).join(' ');

      let startIndex = 0;
      while ((startIndex = line.indexOf(firstName, startIndex)) !== -1) {
        const afterFirstNameIdx = startIndex + firstName.length;
        
        let searchIdx = afterFirstNameIdx;
        let spaceStr = '';
        while (searchIdx < line.length && line[searchIdx] === ' ') {
          spaceStr += ' ';
          searchIdx++;
        }

        let bestMatch = '';
        let minDistance = 999;
        
        const minLen = Math.max(1, surname.length - 2);
        const maxLen = Math.min(line.length - searchIdx, surname.length + 2);
        
        for (let len = minLen; len <= maxLen; len++) {
          if (searchIdx + len <= line.length) {
            const candidate = line.substr(searchIdx, len);
            const dist = getLevenshteinDistance(surname, candidate);
            if (dist < minDistance) {
              minDistance = dist;
              bestMatch = candidate;
            }
          }
        }

        if (minDistance === 0) {
          // Exact match
          startIndex = searchIdx + surname.length;
          continue;
        }

        const tolerance = surname.length > 5 ? 3 : 2;
        if (minDistance > 0 && minDistance <= tolerance && bestMatch.length >= Math.max(2, surname.length / 2)) {
          results.push({
            original: firstName + spaceStr + bestMatch,
            suggestion: fullName,
            reason: 'สะกดนามสกุล สว. ผิด หรือพิมพ์ตกหล่น'
          });
          startIndex = searchIdx + bestMatch.length;
        } else {
          startIndex += firstName.length;
        }
      }
    });

    // Check loanwords
    Object.entries(loanwordMisspellingsDict).forEach(([wrong, correct]) => {
      if (line.includes(wrong)) {
        results.push({
          original: wrong,
          suggestion: correct,
          reason: 'สะกดคำทับศัพท์ผิด'
        });
      }
    });
  });

  return results;
};

export const chunkText = (text: string, maxChunkSize: number = 2000): string[] => {
  const lines = text.split('\\n');
  const chunks: string[] = [];
  let currentChunk = '';

  lines.forEach((line) => {
    const lineWithNewline = `${line}\n`;
    if ((currentChunk.length + lineWithNewline.length) > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = lineWithNewline;
    } else {
      currentChunk += lineWithNewline;
    }
  });

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
};
