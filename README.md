# Sudoku photo game

A Next.js app that turns a Sudoku photo into an editable board and playable game. OpenCV detects and straightens the grid; Tesseract reads isolated digits in the browser. All recognition assets are served from this app. The image is never uploaded to a server.

## Run locally

Requires Node.js 20.9 or newer.

```sh
npm install
npm run dev
```

Open http://localhost:3000. The home screen lists saved puzzles. Choose **New puzzle** to upload a clear, upright photo or enter clues by hand. Each creation receives a random name and timestamp, and is immediately stored as an editable draft. The photo and recognized clues stay in IndexedDB on this browser/device.

Review the clues in the full-width board view, then confirm to start an attempt. A puzzle must have exactly one solution and at least one empty cell. Confirmed original clues are immutable. The puzzle detail screen lists every attempt and lets you resume one or start another independently.

Use the number pad or keyboard (1–9, Delete/Backspace, arrows). Toggle pencil notes with N. Mistake check compares final entries with the unique solution; notes do not count as mistakes. Each entry, erase or note change is saved before it is confirmed in the UI. Reloading an attempt URL restores its latest saved position.

The history controls and slider replay the original state and every move, including notes and mistake counts. Historical positions are read-only. Return to the latest move to continue an unfinished attempt. Completed attempts are permanently read-only in the application and can only be replayed. Start a new attempt to play again.

Timing uses elapsed wall-clock time from start to completion, including time away or with the app closed. Completion freezes the duration. Move records store timestamps and elapsed durations.

Storage is origin-specific: use the same hostname and port to access your collection. There is no account or cloud synchronization. Clearing browser/site data removes saved puzzles. Failed saves show an error without applying an unsaved move; revision checks reject concurrent stale writes from another tab.

## Verification

```sh
npm test
npm run build
npm run test:e2e
```

The browser tests require Google Chrome installed locally. They start the production server on port 3187, upload `tests/fixtures/original.jpeg`, compare all 81 recognized cells with `tests/fixtures/expected.json`, check no photo POSTs or external requests, and exercise saved drafts, reload recovery, independent attempts, notes, read-only history, completed-attempt locking and mobile overflow.

`npm run typecheck` checks TypeScript separately. `npm start` serves the production build. The postinstall script copies OpenCV, Tesseract workers, WASM and English OCR data into the ignored `public/vendor` directory. Re-run `node scripts/copy-assets.mjs` if those generated files are removed.

## Vercel

Import this directory as a Next.js project, with `npm install` and `npm run build`. No API key or environment variables are needed. Deployment was not performed as part of the local reconstruction.

## Limitations and provenance

This is a reconstruction from the referenced conversation's feature requirements; the previous `/home/oai/src` source and Git history were not accessible. No existing app source was copied or committed. The original uploaded image is included only as a test fixture, outside `public`.

OCR can miss or misread digits in rotated, blurry, shadowed or unusual-font photos. Always review clues. A successful original-image regression is not a guarantee for other photos. Persistence is device-local; accounts, synchronization, export and deletion are not implemented.

## Storage and tests

IndexedDB database `sudoku-local`, schema version 1, has `puzzles` and `attempts` stores. Attempts are indexed by puzzle ID. Each move includes a position snapshot; this preserves every historical board and note set without rewriting earlier moves. Writes resolve on transaction completion. Completed attempts and finalized clues are protected in the storage API.

`npm test` includes real transaction API tests using fake-indexeddb as well as pure Sudoku/history tests. See `PHASE2-VERIFICATION.md` for browser checks.
