# Sudoku photo game

A Next.js app that turns a Sudoku photo into an editable board and playable game. OpenCV detects and straightens the grid; Tesseract reads isolated digits in the browser. All recognition assets are served from this app. The image is never uploaded to a server.

## Run locally

Requires Node.js 20.9 or newer.

```sh
npm install
npm run dev
```

Open http://localhost:3000. Choose or drop a clear, upright photo showing the full grid. Review and correct the clues before starting. A board must have exactly one solution to start. Use the number pad or keyboard (1–9, Delete/Backspace, arrows). Toggle pencil notes with N. Mistake check compares final entries with the unique solution; notes do not count as mistakes.

## Verification

```sh
npm test
npm run build
npm run test:e2e
```

The browser tests require Google Chrome installed locally. They start the production server on port 3187, upload `tests/fixtures/original.jpeg`, compare all 81 recognized cells with `tests/fixtures/expected.json`, check no photo POSTs or external requests, and exercise clue locking, highlights, notes, mistakes, reset, review validation and mobile overflow.

`npm run typecheck` checks TypeScript separately. `npm start` serves the production build. The postinstall script copies OpenCV, Tesseract workers, WASM and English OCR data into the ignored `public/vendor` directory. Re-run `node scripts/copy-assets.mjs` if those generated files are removed.

## Vercel

Import this directory as a Next.js project, with `npm install` and `npm run build`. No API key or environment variables are needed. Deployment was not performed as part of the local reconstruction.

## Limitations and provenance

This is a reconstruction from the referenced conversation's feature requirements; the previous `/home/oai/src` source and Git history were not accessible. No existing app source was copied or committed. The original uploaded image is included only as a test fixture, outside `public`.

OCR can miss or misread digits in rotated, blurry, shadowed or unusual-font photos. Always review clues. A successful original-image regression is not a guarantee for other photos. No puzzle persistence or accounts are implemented.
