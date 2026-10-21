import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const STATIC_DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'static-data');

/**
 * Static mode only: serves static-data/ as /static-api/ in dev and copies it into dist-static/static-api/ on build.
 * (Not a public dir, so the snapshot never ends up in the normal dist/.)
 */
function staticDataPlugin() {
  let outDir;
  return {
    name: 'aureus-static-data',
    configResolved(cfg) {
      outDir = path.resolve(cfg.root, cfg.build.outDir);
    },
    buildStart() {
      if (!fs.existsSync(path.join(STATIC_DATA_DIR, 'meta.json'))) {
        this.error('static-data/ is missing. Run `npm run static:data` (with the backend running) before `npm run build:static`.');
      }
    },
    configureServer(server) {
      server.middlewares.use('/static-api', (req, res, next) => {
        const rel = decodeURIComponent((req.url || '/').split('?')[0]);
        const file = path.join(STATIC_DATA_DIR, rel);
        if (!file.startsWith(STATIC_DATA_DIR) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return next();
        const ext = path.extname(file).toLowerCase();
        const types = { '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.gif': 'image/gif', '.pdf': 'application/pdf' };
        res.setHeader('Content-Type', types[ext] || 'application/octet-stream');
        fs.createReadStream(file).pipe(res);
      });
    },
    writeBundle() {
      fs.cpSync(STATIC_DATA_DIR, path.join(outDir, 'static-api'), { recursive: true });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_API_PROXY_TARGET || 'http://localhost:8080';
  const demo = mode === 'demo';
  const staticSite = mode === 'static';
  return {
    plugins: [react(), ...(staticSite ? [staticDataPlugin()] : [])],
    base: demo ? './' : '/',
    server: {
      port: 5173,
      strictPort: true,
      // never watch build output: rebuilding it while the dev server watches crashes it on Windows (EBUSY)
      watch: { ignored: ['**/dist/**', '**/dist-static/**', '**/dist-demo/**', '**/static-data.tmp/**'] },
      // the static site never talks to the backend
      proxy: staticSite ? undefined : {
        '/api': { target, changeOrigin: true },
      },
    },
    preview: {
      port: 4173,
      proxy: staticSite ? undefined : {
        '/api': { target, changeOrigin: true },
      },
    },
    build: demo
      ? {
          // single-file preview (scripts/make-artifact.mjs inlines the output)
          outDir: 'dist-demo',
          assetsInlineLimit: 100000000,
          cssCodeSplit: false,
          chunkSizeWarningLimit: 5000,
          rollupOptions: { output: { inlineDynamicImports: true } },
        }
      : {
          ...(staticSite ? { outDir: 'dist-static', emptyOutDir: true } : {}),
          chunkSizeWarningLimit: 1200,
          rollupOptions: {
            output: {
              manualChunks: {
                react: ['react', 'react-dom', 'react-router-dom'],
                charts: ['recharts'],
              },
            },
          },
        },
  };
});
