/**
 * Headless runner for the synthetic-camera tracking test.
 *
 * Loads /dev/tracking-test in a real browser, waits for the page to publish
 * `window.__testResult`, and exits non-zero if any target failed to track.
 * Usage: node tools/run-tracking-test.mjs [baseUrl]
 */
import puppeteer from 'puppeteer';

const BASE = process.argv[2] ?? process.env.BASE_URL ?? 'https://192.168.1.4:5173';
const CHROME =
  process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  // The dev certs are self-signed, and MindAR needs a GPU path that headless
  // Chrome only provides via SwiftShader.
  ignoreHTTPSErrors: true,
  args: [
    '--ignore-certificate-errors',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--allow-insecure-localhost',
  ],
});

const page = await browser.newPage();
page.on('console', (msg) => console.log(`[page:${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => console.log(`[page:error] ${err.message}`));
page.on('requestfailed', (req) => console.log(`[page:failed] ${req.url()} ${req.failure()?.errorText}`));
page.on('response', (res) => {
  if (!res.ok() && res.status() !== 304) console.log(`[page:http] ${res.status()} ${res.url()}`);
});

// Not networkidle: A-Frame's render loop keeps the page busy, so "idle" may
// never arrive. The real signal is window.__testResult, waited on below.
await page.goto(`${BASE}/dev/tracking-test?seconds=20`, { waitUntil: 'domcontentloaded', timeout: 90_000 });

const result = await page
  .waitForFunction('window.__testResult', { timeout: 180_000, polling: 1000 })
  .then((handle) => handle.jsonValue());

console.log(JSON.stringify(result, null, 2));
await browser.close();
process.exit(result.passed ? 0 : 1);
