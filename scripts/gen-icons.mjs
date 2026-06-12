/**
 * gen-icons.mjs — generate all PWA icon sizes from a single source.
 *
 * Source priority:
 *   1) public/icons/source.png   (drop your own square icon here, then run `npm run icons`)
 *   2) public/icons/icon-master.svg  (built-in fallback design)
 *
 * Output: icon-192.png, icon-512.png, icon-maskable-512.png,
 *         apple-touch-icon.png (180), favicon.png (48)
 */
import sharp from 'sharp';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'public', 'icons');
const srcPng = join(dir, 'source.png');
const srcSvg = join(dir, 'icon-master.svg');

const NAVY = { r: 19, g: 41, b: 74, alpha: 1 }; // #13294a (maskable background)

async function loadSource(size) {
  if (existsSync(srcPng)) {
    return sharp(srcPng).resize(size, size, { fit: 'cover' });
  }
  // rasterize SVG at target size (density scaled so it stays crisp)
  return sharp(srcSvg, { density: Math.round((size / 1024) * 96 * 4) }).resize(size, size);
}

async function plain(size, out) {
  await (await loadSource(size)).png().toFile(join(dir, out));
  console.log('  ✓', out, `(${size}x${size})`);
}

async function maskable(size, out) {
  // logo at 80% inside a full-bleed navy square (safe-zone for adaptive icons)
  const inner = Math.round(size * 0.8);
  const logo = await (await loadSource(inner)).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: NAVY } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(join(dir, out));
  console.log('  ✓', out, `(${size}x${size}, maskable)`);
}

console.log(`Generating icons from: ${existsSync(srcPng) ? 'source.png' : 'icon-master.svg'}`);
await plain(192, 'icon-192.png');
await plain(512, 'icon-512.png');
await maskable(512, 'icon-maskable-512.png');
await plain(180, 'apple-touch-icon.png');
await plain(48, 'favicon.png');
console.log('Done.');
