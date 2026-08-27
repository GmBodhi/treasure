/**
 * Start `wrangler dev` with the same TLS the app uses.
 *
 * The camera needs a secure context, and `localhost` only counts on the machine
 * running the browser — testing on a phone means the LAN IP, which means HTTPS
 * on the API too, or the Vite dev server's proxy has nothing valid to talk to.
 * Certs are optional: without them this falls back to HTTP and says so.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

// Certs are shared by both apps, so they live at the repo root rather than
// being duplicated into each workspace.
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const CERT = process.env.TLS_CERT ?? path.join(ROOT, 'certs/cert.pem');
const KEY = process.env.TLS_KEY ?? path.join(ROOT, 'certs/key.pem');
const PORT = process.env.API_PORT ?? '8787';

const args = ['wrangler', 'dev', '--ip', '0.0.0.0', '--port', PORT];

if (fs.existsSync(CERT) && fs.existsSync(KEY)) {
  args.push('--local-protocol', 'https', '--https-cert-path', CERT, '--https-key-path', KEY);
} else {
  console.warn('[worker] no certs/ pair found — API falls back to HTTP, phone camera will not work');
}

spawn('npx', args, { stdio: 'inherit', shell: true }).on('exit', (code) => process.exit(code ?? 0));
