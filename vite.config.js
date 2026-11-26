import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.resolve(__dirname, 'crm-data.json');
const BACKUP_FILE = path.resolve(__dirname, 'crm-data.backup.json');

function crmAutoSavePlugin() {
  return {
    name: 'crm-auto-save-plugin',
    configureServer(server) {
      server.middlewares.use('/api/crm-data', (req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');

        if (req.method === 'GET') {
          try {
            if (fs.existsSync(DATA_FILE)) {
              const raw = fs.readFileSync(DATA_FILE, 'utf-8');
              const parsed = JSON.parse(raw);
              res.statusCode = 200;
              res.end(JSON.stringify({ exists: true, data: parsed }));
            } else {
              res.statusCode = 200;
              res.end(JSON.stringify({ exists: false }));
            }
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ exists: false, error: err.message }));
          }
          return;
        }

        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk.toString();
          });
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              if (fs.existsSync(DATA_FILE)) {
                fs.copyFileSync(DATA_FILE, BACKUP_FILE);
              }
              fs.writeFileSync(DATA_FILE, JSON.stringify(parsed, null, 2), 'utf-8');
              res.statusCode = 200;
              res.end(JSON.stringify({ ok: true }));
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ ok: false, error: err.message }));
            }
          });
          return;
        }

        res.statusCode = 405;
        res.end(JSON.stringify({ error: 'Method not allowed' }));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), crmAutoSavePlugin()],
  server: {
    port: 5173,
    strictPort: false,
  },
});