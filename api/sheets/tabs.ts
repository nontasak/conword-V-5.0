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
    if (authHeader) {
      try {
        const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=spreadsheetId,sheets.properties`, {
          headers: { 'Authorization': authHeader }
        });
        if (response.ok) {
          const data = await response.json();
          return res.status(200).json(data);
        }
      } catch (e) {
        console.log('API auth call failed, falling back to public fetch');
      }
    }

    // Public fallback without requiring login
    const publicSheets = await getPublicTabs(SPREADSHEET_ID);
    return res.status(200).json({ sheets: publicSheets });
  } catch (error: any) {
    console.error('Error in /api/sheets/tabs:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
