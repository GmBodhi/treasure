#!/usr/bin/env node
/**
 * Compile source images into a MindAR `.mind` target bundle.
 *
 *   npm i -D canvas mind-ar
 *   npm run compile-target -- ../api/seed/targets/demo.mind art/chest.png art/compass.png
 *
 * The order of the input images IS the targetIndex order used by
 * `mindar-image-target="targetIndex: N"` and by the markers in
 * data/experiences.json. Reordering the arguments reorders your content.
 *
 * `canvas` needs a C++ toolchain. If it will not build — common on Windows
 * without Visual Studio — use /studio instead: it runs the same compiler
 * in the browser and uploads the result straight to an experience.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const [outPath, ...images] = process.argv.slice(2);

if (!outPath || images.length === 0) {
  console.error('usage: node tools/compile-target.mjs <out.mind> <image...>');
  process.exit(1);
}

let loadImage;
let OfflineCompiler;
try {
  ({ loadImage } = await import('canvas'));
  ({ OfflineCompiler } = await import('mind-ar/src/image-target/offline-compiler.js'));
} catch (err) {
  console.error('Missing compiler dependencies. Install them first:\n\n  npm i -D canvas mind-ar\n');
  console.error(err.message);
  process.exit(1);
}

console.log(`compiling ${images.length} image(s) -> ${outPath}`);

const loaded = [];
for (const [i, file] of images.entries()) {
  const image = await loadImage(path.resolve(file));
  console.log(`  [${i}] ${file}  ${image.width}x${image.height}`);
  if (Math.min(image.width, image.height) < 300) {
    console.warn(`      warning: small image — tracking is unreliable below ~300px on the short edge`);
  }
  loaded.push(image);
}

const compiler = new OfflineCompiler();
let lastLogged = -1;
await compiler.compileImageTargets(loaded, (progress) => {
  const pct = Math.floor(progress);
  if (pct > lastLogged) {
    lastLogged = pct;
    process.stdout.write(`\r  progress ${pct}%   `);
  }
});
process.stdout.write('\n');

await fs.mkdir(path.dirname(path.resolve(outPath)), { recursive: true });
await fs.writeFile(outPath, Buffer.from(compiler.exportData()));

const { size } = await fs.stat(outPath);
console.log(`wrote ${outPath} (${(size / 1024).toFixed(1)} KB)`);
console.log('Next: point an experience at it —');
console.log(`  curl -F target=@${outPath} http://localhost:3000/api/experiences/demo/target`);
