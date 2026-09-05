// Generates public/icon.svg and the PNG app icons from the mascot markup.
// Usage: node scripts/icons.mjs  (needs Playwright's Chromium for the PNGs)
import fs from 'fs';
import { chromium } from 'playwright';

const src = fs.readFileSync(new URL('../src/game/mascot.ts', import.meta.url), 'utf8');
const body = src.match(/MASCOT_BODY = `([\s\S]*?)`;/)[1];
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8fd873"/><stop offset="1" stop-color="#4fa848"/></linearGradient></defs>
<rect width="200" height="200" rx="44" fill="url(#bg)"/>
<circle cx="100" cy="112" r="74" fill="#ffffff" opacity="0.14"/>
<g transform="translate(22 14) scale(0.97)">${body}</g>
</svg>`;
fs.writeFileSync(new URL('../public/icon.svg', import.meta.url), svg);
const browser = await chromium.launch();
for (const size of [180, 192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(`<style>html,body{margin:0;background:#4fa848}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  await page.screenshot({ path: new URL(`../public/icon-${size}.png`, import.meta.url).pathname, omitBackground: false });
  await page.close();
}
await browser.close();
console.log('icons written');
