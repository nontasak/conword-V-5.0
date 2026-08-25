import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Add request logging
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  // API routes
  const SPREADSHEET_ID = '1GPwZFjNloVXimhpu7Vm3K2e5PN2SjgIvBb_DU-hdDpE';

  app.get("/api/test", (req, res) => {
    res.json({ message: "API is working", timestamp: new Date().toISOString() });
  });

  app.get("/api/routes", (req, res) => {
    const routes = app._router.stack
      .filter((r: any) => r.route)
      .map((r: any) => ({
        path: r.route.path,
        methods: Object.keys(r.route.methods)
      }));
    res.json(routes);
  });

  // Helper functions for fetching Google Sheets without authentication
  async function getPublicTabs(spreadsheetId: string) {
    const parseHtmlForTabs = (html: string) => {
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
    };

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

  app.get("/api/sheets/tabs", async (req, res) => {
    console.log('GET /api/sheets/tabs');
    try {
      const authHeader = req.headers['authorization'];
      if (authHeader) {
        try {
          const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?fields=spreadsheetId,sheets.properties`, {
            headers: { 'Authorization': authHeader }
          });
          if (response.ok) {
            const data = await response.json();
            return res.json(data);
          }
        } catch (e) {
          console.log('API auth call failed, falling back to public fetch');
        }
      }

      // Public fallback without requiring login
      const publicSheets = await getPublicTabs(SPREADSHEET_ID);
      res.json({ sheets: publicSheets });
    } catch (error: any) {
      console.error('Error in /api/sheets/tabs:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/sheets/values", async (req, res) => {
    console.log('GET /api/sheets/values', req.query);
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
            return res.json(data.values || []);
          }
        } catch (e) {
          console.log('API auth values call failed, falling back to public fetch');
        }
      }

      // Public fallback without requiring login
      const publicRows = await getPublicValues(SPREADSHEET_ID, sheetTitle);
      res.json(publicRows);
    } catch (error: any) {
      console.error('Error in /api/sheets/values:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/auth-status", (req, res) => {
    const authHeader = req.headers['authorization'];
    console.log('Auth Header:', authHeader);
    res.json({ 
      hasToken: !!authHeader,
      headers: req.headers 
    });
  });

  // Handle 404 for API routes specifically
  app.use("/api/*", (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
  });

  // Vite middleware for development
  const isProd = process.env.NODE_ENV === "production";
  console.log(`Starting server in ${isProd ? 'production' : 'development'} mode`);

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
