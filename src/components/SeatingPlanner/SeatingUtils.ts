/**
 * Seating Chart Utilities
 */

export interface SeatingName {
  name: string;
  status: 'reference' | 'ocr' | 'manual';
}

export interface SeatingChart {
  president: string;
  leftSide: SeatingName[];
  rightSide: SeatingName[];
}

export const parseSeatingText = (text: string): SeatingChart | null => {
  if (!text || !text.trim()) return null;

  const chart: SeatingChart = {
    president: '',
    leftSide: [],
    rightSide: []
  };

  const lines = text.split('\n').map(l => l.trim()).filter(l => l !== '');
  let currentSection: 'president' | 'left' | 'right' | null = null;

  for (const line of lines) {
    if (line.includes('ประธาน :')) {
      chart.president = line.split('ประธาน :')[1].trim();
      continue;
    }

    if (line.includes('***ซ้ายประธาน***')) {
      currentSection = 'left';
      continue;
    }

    if (line.includes('***ขวาประธาน***')) {
      currentSection = 'right';
      continue;
    }

    // Try to parse numbered list: "1. Name" or just "Name"
    const nameMatch = line.match(/^(\d+\.?\s*)?(.+?)(\s*:\s*)?$/);
    if (nameMatch) {
      const name = nameMatch[2].trim();
      if (!name) continue;
      
      const seatingName: SeatingName = { 
        name, 
        status: 'manual' 
      };

      if (currentSection === 'left') {
        chart.leftSide.push(seatingName);
      } else if (currentSection === 'right') {
        chart.rightSide.push(seatingName);
      }
    }
  }

  return chart;
};

export const formatSeatingText = (chart: SeatingChart): string => {
  const formatName = (name: string) => {
    if (!name) return '';
    const cleanName = name.trim().replace(/[:\s]+$/, '').trim();
    const formatted = cleanName.replace(/\s+/g, '  ');
    return formatted + '  :  ';
  };

  let result = `ประธาน : ${formatName(chart.president)}\n\n`;

  result += `***ซ้ายประธาน***\n`;
  chart.leftSide.forEach((item) => {
    result += `${formatName(item.name)}\n`;
  });

  result += `\n***ขวาประธาน***\n`;
  chart.rightSide.forEach((item) => {
    result += `${formatName(item.name)}\n`;
  });

  return result.trim();
};

/**
 * Fallback command processing logic
 */
export const processCommandFallback = (chart: SeatingChart, command: string): SeatingChart => {
  const newChart = JSON.parse(JSON.stringify(chart)) as SeatingChart;
  const lowerCmd = command.toLowerCase();

  const moveRegex = /move\s+(.+?)\s+to\s+(?:position|index)\s+(\d+)\s+(?:on the\s+)?(left|right)/i;
  const moveMatch = lowerCmd.match(moveRegex);
  if (moveMatch) {
    const name = moveMatch[1].trim();
    const pos = parseInt(moveMatch[2]) - 1;
    const side = moveMatch[3].trim();

    let targetItem: SeatingName | null = null;
    ['leftSide', 'rightSide'].forEach((s) => {
      const sideKey = s as 'leftSide' | 'rightSide';
      const idx = newChart[sideKey].findIndex(n => n.name.toLowerCase() === name.toLowerCase());
      if (idx !== -1) {
        targetItem = newChart[sideKey].splice(idx, 1)[0];
      }
    });

    if (targetItem) {
      const targetList = side === 'left' ? newChart.leftSide : newChart.rightSide;
      targetList.splice(Math.max(0, Math.min(pos, targetList.length)), 0, targetItem);
    }
    return newChart;
  }

  const swapRegex = /swap\s+(.+?)\s+with\s+(.+)/i;
  const swapMatch = lowerCmd.match(swapRegex);
  if (swapMatch) {
    const nameA = swapMatch[1].trim();
    const nameB = swapMatch[2].trim();

    let posA: { side: 'leftSide' | 'rightSide', index: number } | null = null;
    let posB: { side: 'leftSide' | 'rightSide', index: number } | null = null;

    ['leftSide', 'rightSide'].forEach((s) => {
      const side = s as 'leftSide' | 'rightSide';
      const idxA = newChart[side].findIndex(n => n.name.toLowerCase() === nameA.toLowerCase());
      if (idxA !== -1) posA = { side, index: idxA };

      const idxB = newChart[side].findIndex(n => n.name.toLowerCase() === nameB.toLowerCase());
      if (idxB !== -1) posB = { side, index: idxB };
    });

    if (posA && posB) {
      const itemA = newChart[posA.side][posA.index];
      const itemB = newChart[posB.side][posB.index];
      newChart[posA.side][posA.index] = itemB;
      newChart[posB.side][posB.index] = itemA;
    }
    return newChart;
  }

  const removeRegex = /remove\s+(.+)/i;
  const removeMatch = lowerCmd.match(removeRegex);
  if (removeMatch) {
    const name = removeMatch[1].trim();
    ['leftSide', 'rightSide'].forEach((s) => {
      const sideKey = s as 'leftSide' | 'rightSide';
      const idx = newChart[sideKey].findIndex(n => n.name.toLowerCase() === name.toLowerCase());
      if (idx !== -1) newChart[sideKey].splice(idx, 1);
    });
    return newChart;
  }

  const addRegex = /add\s+(.+?)\s+to\s+(?:the\s+)?end\s+of\s+(left|right)/i;
  const addMatch = lowerCmd.match(addRegex);
  if (addMatch) {
    const name = addMatch[1].trim();
    const side = addMatch[2].trim();
    const targetList = side === 'left' ? newChart.leftSide : newChart.rightSide;
    targetList.push({ name, status: 'manual' });
    return newChart;
  }

  return newChart;
};
