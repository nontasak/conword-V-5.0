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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Content-Type': 'application/json; charset=utf-8',
};

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders, status: 204 });
}

export async function onRequestGet(context: { request: Request }) {
  try {
    const url = new URL(context.request.url);
    const authHeader = context.request.headers.get('authorization');
    const sheetTitle = url.searchParams.get('sheetTitle');
    const range = url.searchParams.get('range') || 'A:Z';

    if (!sheetTitle) {
      return new Response(JSON.stringify({ error: 'กรุณาระบุชื่อแท็บ (sheetTitle)' }), {
        headers: corsHeaders,
        status: 400,
      });
    }

    if (authHeader) {
      try {
        const encodedTitle = encodeURIComponent(sheetTitle);
        const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodedTitle}!${range}`, {
          headers: { 'Authorization': authHeader }
        });
        if (response.ok) {
          const data = await response.json();
          return new Response(JSON.stringify(data.values || []), { headers: corsHeaders });
        }
      } catch (e) {
        console.log('API auth values call failed, falling back to public fetch');
      }
    }

    // Public fallback without requiring login
    const publicRows = await getPublicValues(SPREADSHEET_ID, sheetTitle);
    return new Response(JSON.stringify(publicRows), { headers: corsHeaders });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      headers: corsHeaders,
      status: 500,
    });
  }
}
