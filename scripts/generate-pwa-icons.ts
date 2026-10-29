import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const iconsDir = path.join(process.cwd(), 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Leaf path similar to lucide-react Leaf icon, styled for HURIZA branding
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="hurizaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="50%" stop-color="#2677dc"/>
      <stop offset="100%" stop-color="#1d4ed8"/>
    </linearGradient>
    <linearGradient id="leafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#e0e7ff"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#0f2b5c" flood-opacity="0.35"/>
    </filter>
  </defs>
  <!-- Background -->
  <rect width="512" height="512" rx="112" fill="url(#hurizaGrad)"/>
  <!-- Leaf icon with subtle shadow -->
  <g filter="url(#shadow)" transform="translate(64, 64) scale(0.75)">
    <!-- Lucide-style leaf path -->
    <path d="M428 84C428 84 290 80 180 190C70 300 84 428 84 428C84 428 212 442 322 332C432 222 428 84 428 84Z" fill="url(#leafGrad)" stroke="#ffffff" stroke-width="12" stroke-linejoin="round"/>
    <!-- Leaf stem & vein -->
    <path d="M84 428L256 256" stroke="#2677dc" stroke-width="20" stroke-linecap="round"/>
    <path d="M256 256L330 200" stroke="#2677dc" stroke-width="14" stroke-linecap="round"/>
    <path d="M200 312L250 330" stroke="#2677dc" stroke-width="14" stroke-linecap="round"/>
  </g>
</svg>`;

// Maskable icon (with safe padding for circles / rounded squircles on Android)
const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="hurizaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="50%" stop-color="#2677dc"/>
      <stop offset="100%" stop-color="#1d4ed8"/>
    </linearGradient>
    <linearGradient id="leafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#e0e7ff"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#hurizaGrad)"/>
  <g transform="translate(100, 100) scale(0.61)">
    <path d="M428 84C428 84 290 80 180 190C70 300 84 428 84 428C84 428 212 442 322 332C432 222 428 84 428 84Z" fill="url(#leafGrad)" stroke="#ffffff" stroke-width="14" stroke-linejoin="round"/>
    <path d="M84 428L256 256" stroke="#2677dc" stroke-width="22" stroke-linecap="round"/>
    <path d="M256 256L330 200" stroke="#2677dc" stroke-width="16" stroke-linecap="round"/>
    <path d="M200 312L250 330" stroke="#2677dc" stroke-width="16" stroke-linecap="round"/>
  </g>
</svg>`;

async function main() {
  fs.writeFileSync(path.join(iconsDir, 'icon.svg'), svg, 'utf8');
  fs.writeFileSync(path.join(iconsDir, 'icon-maskable.svg'), maskableSvg, 'utf8');

  await sharp(Buffer.from(svg)).resize(192, 192).png().toFile(path.join(iconsDir, 'icon-192.png'));
  await sharp(Buffer.from(svg)).resize(512, 512).png().toFile(path.join(iconsDir, 'icon-512.png'));
  await sharp(Buffer.from(svg)).resize(180, 180).png().toFile(path.join(iconsDir, 'apple-touch-icon.png'));
  await sharp(Buffer.from(maskableSvg)).resize(512, 512).png().toFile(path.join(iconsDir, 'icon-maskable.png'));
  await sharp(Buffer.from(svg)).resize(32, 32).png().toFile(path.join(iconsDir, 'favicon-32.png'));

  console.log('PWA icons generated successfully in public/icons/');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
