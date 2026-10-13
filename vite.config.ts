import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'api-server-middleware',
      configureServer(server) {
        // Ensure data directory exists
        const dataDir = path.resolve(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }

        const dbFile = path.resolve(dataDir, 'inventory_db.json');
        const auditFile = path.resolve(dataDir, 'audit_log.json');
        const correctionsFile = path.resolve(dataDir, 'manual_corrections.json');
        const publicPlotsFile = path.resolve(__dirname, 'public/data/plots.json');

        // Initialize persistent DB if not present
        if (!fs.existsSync(dbFile) && fs.existsSync(publicPlotsFile)) {
          fs.copyFileSync(publicPlotsFile, dbFile);
        }

        // Middleware for parsing JSON body
        server.middlewares.use((req, res, next) => {
          if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
              body += chunk;
            });
            req.on('end', () => {
              try {
                (req as any).body = body ? JSON.parse(body) : {};
              } catch (e) {
                (req as any).body = {};
              }
              next();
            });
          } else {
            next();
          }
        });

        // API routes
        server.middlewares.use((req, res, next) => {
          const url = req.url || '';

          // GET /api/plots
          if (url === '/api/plots' && req.method === 'GET') {
            res.setHeader('Content-Type', 'application/json');
            const target = fs.existsSync(dbFile) ? dbFile : publicPlotsFile;
            res.end(fs.readFileSync(target, 'utf-8'));
            return;
          }

          // POST /api/plots/:plotNumber/status
          const statusMatch = url.match(/^\/api\/plots\/(\d+)\/status$/);
          if (statusMatch && req.method === 'POST') {
            const plotNumber = parseInt(statusMatch[1], 10);
            const payload = (req as any).body;

            const target = fs.existsSync(dbFile) ? dbFile : publicPlotsFile;
            let plots = JSON.parse(fs.readFileSync(target, 'utf-8'));
            const plotIdx = plots.findIndex((p: any) => p.plotNumber === plotNumber);

            if (plotIdx !== -1) {
              const prev = { ...plots[plotIdx] };
              plots[plotIdx].status = payload.status || plots[plotIdx].status;
              if (payload.baseRatePerSqm) {
                plots[plotIdx].baseRatePerSqm = payload.baseRatePerSqm;
                plots[plotIdx].totalPrice = Math.round(plots[plotIdx].calculatedArea * payload.baseRatePerSqm);
              }
              if (payload.customer) {
                plots[plotIdx].customer = payload.customer;
              }

              // Persist to both dbFile and publicPlotsFile
              fs.writeFileSync(dbFile, JSON.stringify(plots, null, 2));
              fs.writeFileSync(publicPlotsFile, JSON.stringify(plots, null, 2));

              // Record audit log
              let audits = fs.existsSync(auditFile) ? JSON.parse(fs.readFileSync(auditFile, 'utf-8')) : [];
              audits.push({
                id: 'AUDIT_' + Date.now(),
                plotNumber,
                action: 'STATUS_UPDATE',
                previousStatus: prev.status,
                newStatus: plots[plotIdx].status,
                timestamp: new Date().toISOString(),
                user: payload.updatedBy || 'Sales Administrator'
              });
              fs.writeFileSync(auditFile, JSON.stringify(audits, null, 2));

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, plot: plots[plotIdx] }));
            } else {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: 'Plot not found' }));
            }
            return;
          }

          // POST /api/plots/:plotNumber/manual-correction
          const corrMatch = url.match(/^\/api\/plots\/(\d+)\/manual-correction$/);
          if (corrMatch && req.method === 'POST') {
            const plotNumber = parseInt(corrMatch[1], 10);
            const payload = (req as any).body;

            let corrections = fs.existsSync(correctionsFile) ? JSON.parse(fs.readFileSync(correctionsFile, 'utf-8')) : [];
            corrections.push({
              id: 'CORR_' + Date.now(),
              plotNumber,
              correctionType: payload.correctionType || 'BOUNDARY_ADJUSTMENT',
              notes: payload.notes || '',
              correctedCoordinates: payload.coordinates,
              timestamp: new Date().toISOString()
            });
            fs.writeFileSync(correctionsFile, JSON.stringify(corrections, null, 2));

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, correctionId: corrections[corrections.length - 1].id }));
            return;
          }

          // GET /api/audit-logs
          if (url === '/api/audit-logs' && req.method === 'GET') {
            res.setHeader('Content-Type', 'application/json');
            const audits = fs.existsSync(auditFile) ? fs.readFileSync(auditFile, 'utf-8') : '[]';
            res.end(audits);
            return;
          }

          next();
        });
      }
    }
  ],
  server: {
    port: 3000,
    host: true
  }
});
