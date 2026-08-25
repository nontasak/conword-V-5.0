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

