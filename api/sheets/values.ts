const SPREADSHEET_ID = '1GPwZFjNloVXimhpu7Vm3K2e5PN2SjgIvBb_DU-hdDpE';

async function getPublicValues(spreadsheetId: string, sheetTitle: string) {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetTitle)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) return [];

  const parsed = JSON.parse(text.substring(start, end + 1));
  if (!parsed.table || !parsed.table.rows) return [];

  const rows = parsed.table.rows.map((r: any) => {
    if (!r.c) return [];
    return r.c.map((cell: any) => {
      if (!cell) return '';
      if (cell.f) return cell.f;
      if (cell.v !== null && cell.v !== undefined) return String(cell.v);
      return '';
    });
  });

  return rows;
}

export default async function handler(req: any, res: any) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const authHeader = req.headers['authorization'];
    const sheetTitle = req.query.sheetTitle as string;
    const range = (req.query.range as string) || 'A:Z';

    if (!sheetTitle) {
      return res.status(400).json({ error: 'กรุณาระบุชื่อแท็บ (sheetTitle)' });
    }

    if (authHeader) {
      try {
        const encodedTitle = encodeURIComponent(sheetTitle);
        const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodedTitle}!${range}`, {
          headers: { 'Authorization': authHeader }
        });
        if (response.ok) {
          const data = await response.json();
          return res.status(200).json(data.values || []);
        }
      } catch (e) {
        console.log('API auth values call failed, falling back to public fetch');
      }
    }

    // Public fallback without requiring login
    const publicRows = await getPublicValues(SPREADSHEET_ID, sheetTitle);
    return res.status(200).json(publicRows);
  } catch (error: any) {
    console.error('Error in /api/sheets/values:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
