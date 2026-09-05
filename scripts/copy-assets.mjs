import { mkdir, copyFile, readdir } from 'node:fs/promises';
const dest = new URL('../public/vendor/', import.meta.url);
await mkdir(dest, { recursive: true });
await copyFile('node_modules/@techstark/opencv-js/dist/opencv.js', new URL('opencv.js', dest));
await copyFile('node_modules/tesseract.js/dist/worker.min.js', new URL('worker.min.js', dest));
for (const file of await readdir('node_modules/tesseract.js-core')) {
  if (/\.wasm(\.js)?$/.test(file))
    await copyFile('node_modules/tesseract.js-core/' + file, new URL(file, dest));
}
await copyFile(
  'node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz',
  new URL('eng.traineddata.gz', dest),
);
console.log('Local OpenCV and Tesseract runtime assets copied.');
