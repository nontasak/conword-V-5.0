export interface SheetTab {
  properties: {
    title: string;
    sheetId: number;
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
