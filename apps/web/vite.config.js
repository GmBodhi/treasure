import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Certs are shared by both apps, so they live at the repo root rather than
// being duplicated into each workspace.
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CERT = process.env.TLS_CERT ?? path.join(ROOT, 'certs/cert.pem');
const KEY = process.env.TLS_KEY ?? path.join(ROOT, 'certs/key.pem');
const API_PORT = Number(process.env.API_PORT ?? 8787);

/**
 * The dev server mirrors the API server's TLS setup. `getUserMedia` needs a
 * secure context, and `localhost` only counts on the machine running the
 * browser — a phone hitting the LAN IP does not get the localhost exemption,
 * so hot reload on a real device requires HTTPS here too.
 */
function devTls() {
  if (!fs.existsSync(CERT) || !fs.existsSync(KEY)) {
    console.warn('[vite] no certs/ pair found — dev server falls back to HTTP, phone camera will not work');
    return undefined;
  }
  return { cert: fs.readFileSync(CERT), key: fs.readFileSync(KEY) };
}

const https = devTls();

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // A-Frame's bundle references `global` and expects a browser-ish CommonJS
  // environment; without this it throws "global is not defined" on load.
  define: { global: 'globalThis' },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  optimizeDeps: {
    // Both are large prebuilt bundles. Letting esbuild pre-bundle aframe keeps
    // the first page load from requesting a thousand modules; mind-ar's aframe
    // build is an IIFE that must run after AFRAME exists, so it is excluded and
    // loaded explicitly by src/ar/aframe.js.
    include: ['aframe'],
    exclude: ['mind-ar'],
  },
  server: {
    host: true,
    port: 5173,
    https,
    proxy: {
      // Proxying keeps dev same-origin, so the cross-origin path the Worker
      // serves in production is exercised by CORS config, not by the browser
      // having to trust a second self-signed cert.
      '/api': {
        target: `${https ? 'https' : 'http'}://127.0.0.1:${API_PORT}`,
        changeOrigin: true,
        // The Worker dev server uses the same self-signed cert; do not reject it.
        secure: false,
      },
    },
  },
  // `vite preview` is the production shape: the built app on its own origin,
  // talking to the deployed Worker cross-origin. No proxy here on purpose —
  // that is what makes it exercise CORS rather than hide it.
  preview: {
    host: true,
    port: 4173,
    https,
  },

  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
