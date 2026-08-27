/**
 * Route smoke test: loads every page, fails on any console error or missing
 * landmark text. Usage: node tools/smoke.mjs [baseUrl]
 */
import puppeteer from 'puppeteer';

const BASE = process.argv[2] ?? process.env.APP_BASE ?? 'https://192.168.1.4:5173';
const ROUTES = [
  ['/', 'Treasure Demo Hunt'],
  ['/markers', 'Printable markers'],
  ['/studio', 'Target studio'],
  ['/admin', 'Treasure AR console'],
];

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  ignoreHTTPSErrors: true,
  args: ['--ignore-certificate-errors', '--allow-insecure-localhost'],
});

let failures = 0;
for (const [route, expected] of ROUTES) {
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(BASE + route, { waitUntil: 'networkidle2', timeout: 45_000 });
  await new Promise((r) => setTimeout(r, 800));
  const text = await page.evaluate(() => document.body.innerText);
  const ok = text.includes(expected) && errors.length === 0;

  console.log(`${ok ? 'PASS' : 'FAIL'} ${route}  ${ok ? '' : `\n  text-match=${text.includes(expected)} errors=${JSON.stringify(errors.slice(0, 3))}`}`);
  if (!ok) failures += 1;
  await page.close();
}

await browser.close();
process.exit(failures ? 1 : 0);
