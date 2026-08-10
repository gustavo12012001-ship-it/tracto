import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const outDir = join(root, 'png');
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 1500 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(join(root, 'carousel.html')).href, { waitUntil: 'networkidle' });

const slides = await page.locator('.slide').all();

for (const slide of slides) {
  const name = await slide.getAttribute('data-slide');
  await slide.screenshot({
    path: join(outDir, `${name}.png`),
    type: 'png',
    animations: 'disabled',
  });
}

await browser.close();
console.log(`Exportados ${slides.length} cards em ${outDir}`);
