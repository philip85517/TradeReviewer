import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const output = path.dirname(new URL(import.meta.url).pathname);
const source = path.resolve('docs/design-system/baselines/2026-10-22-homepage-v2.5/source/images');
const files = ['filter.svg', 'multi-applied.svg', 'multi-applied--reopen.svg', 'error--update-failure.svg', 'history.svg', 'history-stats-cumulative.svg', 'history-stats-win.svg', 'history-stats-rounds.svg', 'contribution-current-a-share.svg', 'journeys-library-entry.svg', 'library-return.svg', 'search-detail.svg'];
const width = 720;
const height = 500;
const composites = [];
for (let index = 0; index < files.length; index++) {
  const image = await sharp(fs.readFileSync(path.join(source, files[index]))).resize(width, height - 28, { fit: 'inside' }).png().toBuffer();
  const label = Buffer.from(`<svg width="720" height="28"><rect width="720" height="28" fill="white"/><text x="8" y="20" font-size="16" font-family="Arial">${files[index]}</text></svg>`);
  const left = (index % 2) * width;
  const top = Math.floor(index / 2) * height;
  composites.push({ input: label, left, top }, { input: image, left, top: top + 28 });
}
await sharp({ create: { width: width * 2, height: height * Math.ceil(files.length / 2), channels: 3, background: '#e2e8f0' } }).composite(composites).png().toFile(path.join(output, 'reference-contact-sheet.png'));
console.log(path.join(output, 'reference-contact-sheet.png'));
