export interface SheetTab {
  properties: {
    title: string;
    sheetId: number | string;
  };
}

export interface SpreadsheetData {
  spreadsheetId: string;
  sheets: SheetTab[];
}

export const SPREADSHEET_ID = '1GPwZFjNloVXimhpu7Vm3K2e5PN2SjgIvBb_DU-hdDpE';

export function parseHtmlForTabs(html: string): SheetTab[] {
  const sheets: SheetTab[] = [];
  const itemBlocks = [...html.matchAll(/items\.push\((\{[\s\S]*?\})\);/g)];

  for (const block of itemBlocks) {
    const str = block[1];
    const nameMatch = str.match(/name:\s*["'](.*?)["'],/s);
    const gidMatch = str.match(/gid:\s*["']([0-9]+)["']/);
    if (nameMatch && gidMatch) {
      const title = nameMatch[1].replace(/\\/g, '').trim();
      const gid = gidMatch[1];
      if (!sheets.find(s => String(s.properties.sheetId) === String(gid))) {
        sheets.push({
          properties: {
            sheetId: gid,
            title: title
          }
        });
      }
    }
  }

  if (sheets.length === 0) {
    const titleRegex = /<li id="sheet-button-([0-9]+)"><a [^>]*>([^<]+)<\/a>/g;
    let match;
    while ((match = titleRegex.exec(html)) !== null) {
      sheets.push({
        properties: {
          sheetId: match[1],
          title: match[2].trim()
        }
      });
    }
  }

  return sheets;
}

export async function fetchSpreadsheetMetadata(accessToken: string): Promise<SpreadsheetData> {
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=spreadsheetId,sheets.properties`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to fetch spreadsheet metadata');
  }

  return response.json();
}

export async function fetchSheetData(accessToken: string, sheetTitle: string, range: string = 'A:Z'): Promise<any[][]> {
  const encodedTitle = encodeURIComponent(sheetTitle);
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodedTitle}!${range}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to fetch sheet data');
  }

  const data = await response.json();
  return data.values || [];
}

export async function fetchPublicGvizValues(sheetTitle: string): Promise<any[][]> {
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetTitle)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) return [];

  const parsed = JSON.parse(text.substring(start, end + 1));
  if (!parsed.table || !parsed.table.rows) return [];

  return parsed.table.rows.map((r: any) => {
    if (!r.c) return [];
    return r.c.map((cell: any) => {
      if (!cell) return '';
      if (cell.f) return cell.f;
      if (cell.v !== null && cell.v !== undefined) return String(cell.v);
      return '';
    });
  });
}

export async function fetchPublicTabsFallback(): Promise<SheetTab[]> {
  const targetUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/htmlview`;
  
  // 1. Direct fetch attempt
  try {
    const res = await fetch(targetUrl);
    if (res.ok) {
      const html = await res.text();
      const tabs = parseHtmlForTabs(html);
      if (tabs.length > 0) return tabs;
    }
  } catch (e) {
    // Expected in browser if CORS blocked
  }

  // 2. allorigins proxy attempt
  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
    const res = await fetch(proxyUrl);
    if (res.ok) {
      const html = await res.text();
      const tabs = parseHtmlForTabs(html);
      if (tabs.length > 0) return tabs;
    }
  } catch (e) {
    console.warn('allorigins proxy for htmlview failed:', e);
  }

  // 3. corsproxy.io attempt
  try {
    const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`;
    const res = await fetch(proxyUrl);
    if (res.ok) {
      const html = await res.text();
      const tabs = parseHtmlForTabs(html);
      if (tabs.length > 0) return tabs;
    }
  } catch (e) {
    console.warn('corsproxy proxy for htmlview failed:', e);
  }

  // 4. pubhtml via allorigins proxy
  try {
    const pubUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/pubhtml`;
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(pubUrl)}`;
    const res = await fetch(proxyUrl);
    if (res.ok) {
      const html = await res.text();
      const tabs = parseHtmlForTabs(html);
      if (tabs.length > 0) return tabs;
    }
  } catch (e) {
    console.warn('allorigins proxy for pubhtml failed:', e);
  }

  return [];
}


