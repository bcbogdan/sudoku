# Phase 2: local persistence and attempt history

Implemented against first-phase commit `3b23a4a`. Changes are uncommitted.

## Features

- A puzzle library and a separate creation screen.
- Random puzzle names, creation/update timestamps, original image blobs, and default clue states saved in IndexedDB.
- Manual drafts and recognized-photo drafts autosave; confirmed clues become immutable.
- Multiple independent attempts per puzzle, addressable by URL and recoverable after reload.
- Timestamped entry, erase and candidate-note moves with complete position snapshots.
- First/previous/next/latest controls and a history slider. Browsing old positions never rewrites an attempt.
- Completed attempts are locked in both the UI and storage layer. Their final durations are frozen.
- Elapsed duration includes time away from the app; UI and README disclose this definition.
- Full-width review/play layout without the old left sidebar.
- Save errors are reported and stale concurrent writes are rejected instead of overwriting newer state.

## Verification

- `npm test`: 12 passed, 0 failed, 0 skipped (5 original tests plus 7 new persistence/history tests).
- `npm run typecheck`: passed.
- `npm run build`: passed, including TypeScript and static page generation.
- Installed fake-indexeddb as a development-only test dependency. npm audit reported zero vulnerabilities.

Built-in browser checks against the production app at `http://localhost:3187`:

1. Original photo recognized as 32 correct clues, persisted under a random name and timestamp, and survived reload.
2. A confirmed puzzle created a saved attempt. Candidate notes 1 and 2 survived reload. Previous-move replay showed only note 1 and disabled entry controls.
3. A wrong entry and mistake count survived reload. A second attempt started with the untouched original board and zero moves. Returning to the first attempt restored its own independent progress.
4. Completed the first test attempt: 52 recorded moves including notes and a correction, duration 00:02:25. Reload retained the same duration; keyboard erasure was blocked. Previous/next history controls replayed the final move while the record remained locked.
5. The attempt list showed one completed and one unfinished attempt. The puzzle library showed its original clues and two attempts.
6. At 390 × 844, the board was 362 pixels wide with 14-pixel side margins. Document width was exactly 390 pixels, and the old sidebar was absent.
7. No browser console errors were reported during checked interactions.

The Playwright suite has been updated for the new flows. Its standalone Chrome-launch blocker from phase 1 was not resolved or re-tested; browser verification above used the built-in browser rather than claiming a successful standalone Playwright run.

## Scope

Device-local storage only; no cloud sync or accounts. Browser storage is scoped to hostname/port. Clearing site data removes records. No commit or deployment performed for this phase.
