const SPREADSHEET_ID = '1GPwZFjNloVXimhpu7Vm3K2e5PN2SjgIvBb_DU-hdDpE';

function parseHtmlForTabs(html: string) {
  const sheets: any[] = [];
  const itemBlocks = [...html.matchAll(/items\.push\((\{[\s\S]*?\})\);/g)];

  for (const block of itemBlocks) {
    const str = block[1];
    const nameMatch = str.match(/name:\s*["'](.*?)["'],/s);
    const gidMatch = str.match(/gid:\s*["']([0-9]+)["']/);
    if (nameMatch && gidMatch) {
      const title = nameMatch[1].replace(/\\/g, '').trim();
      const gid = gidMatch[1];
      if (!sheets.find(s => s.properties.sheetId === gid)) {
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

async function getPublicTabs(spreadsheetId: string) {
  // Try htmlview first (contains all live tabs in the document)
  try {
    const resHtml = await fetch(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/htmlview`);
    if (resHtml.ok) {
      const html = await resHtml.text();
      const sheets = parseHtmlForTabs(html);
      if (sheets.length > 0) return sheets;
    }
  } catch (e) {
    console.error('Failed to fetch tabs from htmlview:', e);
  }

  // Fallback to pubhtml
  try {
    const resPub = await fetch(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/pubhtml`);
    if (resPub.ok) {
      const html = await resPub.text();
      return parseHtmlForTabs(html);
    }
  } catch (e) {
    console.error('Failed to fetch tabs from pubhtml:', e);
  }

  return [];
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
    const authHeader = context.request.headers.get('authorization');
    if (authHeader) {
      try {
        const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=spreadsheetId,sheets.properties`, {
          headers: { 'Authorization': authHeader }
        });
        if (response.ok) {
          const data = await response.json();
          return new Response(JSON.stringify(data), { headers: corsHeaders });
        }
      } catch (e) {
        console.log('API auth call failed, falling back to public fetch');
      }
    }

    // Public fallback without requiring login
    const publicSheets = await getPublicTabs(SPREADSHEET_ID);
    return new Response(JSON.stringify({ sheets: publicSheets }), { headers: corsHeaders });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      headers: corsHeaders,
      status: 500,
    });
  }
}
