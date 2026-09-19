import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react(), {
    name: 'local-benchmark-fx-fixture',
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== '/api/fx') return next();
        res.setHeader('Content-Type','application/json');
        res.setHeader('Cache-Control','no-store');
        if (req.method !== 'GET') { res.statusCode=405; res.end('{}'); return; }
        res.end(JSON.stringify({snapshot:{version:1,baseCurrency:'CNY',rates:{CNY:1,HKD:0.9,USD:7},source:{id:'frankfurter-ecb',label:'性能测试固定夹具',url:'',attributionUrl:''},rateDate:'2026-09-18',fetchedAt:'2026-09-19T00:00:00Z',lastAttemptedAt:'2026-09-19T00:00:00Z',cacheStatus:'cached'}}));
      });
    },
  }],
  build: { outDir: '../performance-dist', emptyOutDir: true },
  preview: { host: '127.0.0.1', port: 3032, strictPort: true },
});
