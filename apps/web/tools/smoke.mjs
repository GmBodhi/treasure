/**
 * Route smoke test: loads every page, fails on any console error or missing
 * landmark text. Usage: node tools/smoke.mjs [baseUrl]
 */
import puppeteer from 'puppeteer';

const BASE = process.argv[2] ?? process.env.APP_BASE ?? 'https://192.168.1.4:5173';
const ROUTES = [
  ['/', 'Operation Breadcrumb'],
  ['/leaderboard', 'Standings'],
  ['/markers', 'Printable markers'],
  ['/studio', 'Target studio'],
  ['/admin', 'Operation Breadcrumb console'],
];

/** Chrome's location differs per platform; CHROME_PATH overrides all of it. */
function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  if (process.platform === 'darwin')
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (process.platform === 'win32')
    return 'C:/Program Files/Google/Chrome/Application/chrome.exe';
  return '/usr/bin/google-chrome';
}

const browser = await puppeteer.launch({
  executablePath: chromePath(),
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
