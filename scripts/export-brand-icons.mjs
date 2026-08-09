// Export the canonical SVG without changing its geometry or adding a background.
// Reuse Next's installed sharp dependency; no additional package installation.
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve('next/package.json'));
const sharp = nextRequire('sharp');
const svg = await readFile(
  new URL('../public/favicons/logo-mark.svg', import.meta.url),
);
const raster = (size) =>
  sharp(svg, { density: 216 })
    .resize(size, size)
    .ensureAlpha()
    .png()
    .toBuffer();
const icon = await raster(512);
await writeFile(new URL('../src/app/icon.png', import.meta.url), icon);
await writeFile(new URL('../src/app/apple-icon.png', import.meta.url), icon);
const sizes = [16, 32, 48];
const frames = await Promise.all(sizes.map(raster));
const header = Buffer.alloc(6 + frames.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(frames.length, 4);
let offset = header.length;
frames.forEach((frame, index) => {
  const entry = 6 + index * 16;
  header[entry] = sizes[index];
  header[entry + 1] = sizes[index];
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(frame.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += frame.length;
});
await writeFile(
  new URL('../src/app/favicon.ico', import.meta.url),
  Buffer.concat([header, ...frames]),
);
console.log(
  'Exported transparent 512px PNG/Apple PNG and 16/32/48px ICO from logo-mark.svg.',
);
