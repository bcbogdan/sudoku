# Sudoku reconstruction and verification

Project: `/Users/bogdan/src/sudoku`

The previous `/home/oai/src` repository was not accessible. No matching source was found in the searched local source/workspace folders. This is a new implementation of the features described in the referenced conversation, not a copy of the previous implementation. No Git repository was initialized, no previous history was altered, and no commits were made.

## Install

Environment: Node 22.22.0, npm 10.9.4.

Initial `npm view` requests failed with `EPERM` while writing `/Users/bogdan/.npm/_cacache/tmp`. Retried using a writable temporary cache, without modifying the user's existing cache.

Successful command: `npm --cache /private/tmp/sudoku-npm-cache install`.

- Exit code: 0.
- Added 49 packages and audited 50 in 11 seconds.
- 0 vulnerabilities reported.
- Local OpenCV, Tesseract worker/WASM and English recognition data copied successfully by postinstall.
- npm warned that tesseract.js and esbuild install scripts were not yet covered by its allowScripts configuration. This was a warning; installation and subsequent compilation completed.

Installed principal versions: Next.js 16.3.4, React/React DOM 19.2.8, Tesseract.js 7.0.0, OpenCV.js 4.12.0-release.1, TypeScript 5.9.3, Playwright 1.63.0.

## Build and logic tests

- `npm run build` (`next build --webpack`): exit 0. Final build compiled successfully, passed TypeScript, generated 3 static pages, and completed trace collection. Routes `/` and `/_not-found` are static.
- The first build warned about an unrelated lockfile in `/Users/bogdan`. Setting `outputFileTracingRoot` to the project directory removed that warning from subsequent builds.
- `npm run typecheck`: exit 0.
- `npm test`: exit 0; 5 passed, 0 failed, 0 skipped. Final run duration 111.1505 ms.

Logic coverage: original puzzle has 32 clues and exactly one valid solution; conflicting clues rejected; multiple solutions detected; malformed boards rejected; row/column/box peer relationships checked.

## Browser testing

`npm run test:e2e` exited 1: both tests failed at browser launch, before reaching app assertions. Google Chrome aborted with SIGABRT; Playwright reported “Target page, context or browser has been closed” and `kill EPERM`. This automated runner remains unverified in this environment. Its test files remain available for running outside the restricted launch environment.

Fallback testing used the Codex built-in Chromium browser against the actual production Next.js app. The original uploaded JPEG was selected through the real file chooser. The expected matrix exists only in the test fixture; application code does not contain the original puzzle or substitute it for OCR.

### Concrete issues found and fixed

1. The initial OpenCV loader awaited a legacy Emscripten object whose `then` method returns itself. This caused an endless Promise-resolution loop and a stalled tab. The loader now waits for `onRuntimeInitialized` and resolves a wrapper containing the module. The browser pipeline subsequently completed.
2. Tesseract `SINGLE_CHAR` mode missed/misread several isolated digits. Switching to `SINGLE_WORD` for the normalized single-digit crops produced an exact result on the original image.

### Final original-photo result

- 32 printed clues recognized.
- 32/32 printed clues correct.
- 81/81 cell values match the expected matrix.
- 0 missed clues.
- 0 wrong digits.
- 0 false positives.
- No browser errors reported in the successful session.

Additional successful in-app browser checks:

- Confirmation starts a game with exactly 32 locked clues.
- Attempting to overwrite a locked 5 leaves it unchanged.
- Selecting that clue highlights both matching 5s and all 21 row/column/box peers including the selected cell.
- Notes 1 and 2 appear together without changing the cell's final value.
- An incorrect final entry is marked wrong and increments mistakes to 1.
- Turning mistake checking off removes the error mark.
- A correct entry is accepted.
- Reset clears user entries and returns the mistake count to 0.
- Editing a clue to introduce a duplicate prevents play; erasing that duplicate permits play again.
- At 390 × 844, document width is 390 pixels: no horizontal overflow.

The automated suite's request interception assertions were not executed because its browser did not launch. Source uses same-origin OCR assets and performs recognition in the browser; no image-upload endpoint was implemented.

## Files created

- `app/page.tsx`, `app/layout.tsx`, `app/globals.css`: upload/review/play UI with keyboard input, candidate notes, highlights and optional mistake checking.
- `lib/localSudokuReader.ts`: perspective correction, cell segmentation, central-component filtering and local OCR.
- `lib/sudoku.ts`: validation, uniqueness checking and solver used internally for mistake checking.
- `scripts/copy-assets.mjs`: installs recognition assets for same-origin delivery.
- `tests/sudoku.test.ts`, `tests/browser.spec.ts`, `playwright.config.ts`, and original-image/expected-matrix fixtures.
- Package manifest/lockfile, TypeScript and Next.js configuration, README and ignore rules.

Run locally with `cd /Users/bogdan/src/sudoku` and `npm run dev`. No API key is required. No deployment was performed. OCR reliability on other photos has not been established; the editable review step remains necessary.
