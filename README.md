# Sudoku photo game

A Next.js app that turns a Sudoku photo into an editable board and playable game. OpenCV detects and straightens the grid; Tesseract reads isolated digits in the browser. All recognition assets are served from this app. The image is never uploaded to a server.

## Run locally

Use Node.js 22 (`nvm use` reads the included `.nvmrc`), matching the Vercel runtime.

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

The repository includes `vercel.json` with the Next.js framework preset, `npm ci` for reproducible installs, and `npm run build`. `package.json` pins the deployment runtime to Node.js 22.x. Leave the output directory on the Next.js default; do not set it to `public`.

1. Push the repository to your Git provider and import it in Vercel.
2. Set the project's Root Directory to this repository's root (the folder containing `package.json` and `vercel.json`).
3. Deploy using the checked-in settings. No API keys, environment variables, database service, or server-side storage are needed.

Alternatively, run `npx vercel` from this directory to link a project and create a preview deployment; use `npx vercel --prod` when ready for production. These commands require your Vercel account and may prompt for project settings. Local `.vercel` account/project metadata is ignored by Git and Prettier.

`npm ci` runs `postinstall`, which recreates all locally served OpenCV/Tesseract assets in `public/vendor`. Keep this hook enabled: these generated assets are deliberately not committed. Vercel serves them alongside the Next.js application; the uploaded Sudoku photo is processed in the browser.

IndexedDB data belongs to each origin: localhost, preview URLs, and your production domain have separate collections. Existing local puzzles do not automatically transfer to production. Use a stable production domain to retain the same browser collection.

This task configures deployment but does not create, link, or publish a Vercel project. See [Vercel configuration](https://vercel.com/docs/project-configuration/vercel-json) and [Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

## Limitations and provenance

This is a reconstruction from the referenced conversation's feature requirements; the previous `/home/oai/src` source and Git history were not accessible. No existing app source was copied or committed. The original uploaded image is included only as a test fixture, outside `public`.

OCR can miss or misread digits in rotated, blurry, shadowed or unusual-font photos. Always review clues. A successful original-image regression is not a guarantee for other photos. Persistence is device-local; accounts, synchronization and full-library export are not implemented.

## Storage and tests

IndexedDB database `sudoku-local`, schema version 1, has `puzzles` and `attempts` stores. Attempts are indexed by puzzle ID. Each move includes a position snapshot; this preserves every historical board and note set without rewriting earlier moves. Writes resolve on transaction completion. Completed attempts and finalized clues are protected in the storage API.

`npm test` includes real transaction API tests using fake-indexeddb as well as pure Sudoku/history tests. See `PHASE2-VERIFICATION.md` for browser checks.

## Mobile, names and appearance

Use the pencil button beside a puzzle title to rename it. Names are trimmed, limited to 80 characters, and saved in IndexedDB; renaming preserves original clues and every attempt, including completed attempts. Cancel or Escape discards an unfinished rename.

Layouts adapt to narrow phones, tablets and landscape screens. The keypad uses two rows whenever its board container is narrow, maintaining large touch targets. The app follows `prefers-color-scheme` automatically; its light and dark palettes cover the board, notes, highlights, errors, library and forms without a separate toggle.

## Formatting

Prettier is installed as an exact development dependency with shared settings in `.prettierrc.json`. Run `npm run format` to format source, styles, JSON and documentation, or `npm run format:check` to verify formatting in CI. Generated framework files, OCR assets, dependency lockfiles and test output are excluded in `.prettierignore`. Editors with Prettier support use the same repository settings.

## Sharing and removal

Choose **Share puzzle** on a draft, puzzle details or attempt screen. Copy the displayed link (manual selection is available if clipboard access is unavailable). Its format is `/?p=<encodedPuzzle>&n=<name>`: `p` is the URL-safe Base64 encoding of 81 row-major digits, where `0` means empty; `n` is the URL-encoded name. Only original clues and the name are included, never the photo, solution or attempt history.

Opening the link validates the data and creates a local draft with a new ID and timestamp for the recipient to review. Reopening the same clues/name link reuses that imported local puzzle and preserves its attempts; refreshing switches to the local puzzle URL. Malformed or conflicting boards are rejected without saving. Shared drafts can still require corrections before they have a unique solution.

Choose **Remove puzzle** from a draft, puzzle details or attempt screen. A confirmation names the puzzle and warns that all local attempts will also be removed. Cancelling changes nothing. Confirming deletes the puzzle, stored photo and all attempts in one IndexedDB transaction; other puzzles are untouched. Removing a local puzzle does not revoke existing sharing links, which can still create another local copy.
