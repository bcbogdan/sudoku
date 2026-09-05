import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyMove,
  initialPosition,
  positionAt,
  durationLabel,
  type Attempt,
} from '../lib/attempts';
import {
  createPuzzle,
  saveDraft,
  startAttempt,
  recordMove,
  listPuzzles,
  listAttempts,
} from '../lib/storage';
import { solve } from '../lib/sudoku';
import clues from './fixtures/expected.json';
const solution = solve(clues).solution!;
function attempt(): Attempt {
  return {
    id: 'a',
    puzzleId: 'p',
    startedAt: 1000,
    completedAt: null,
    durationMs: null,
    initial: initialPosition(clues),
    moves: [],
    revision: 0,
  };
}
test('history preserves entries, notes, erases, mistakes and original state', () => {
  let a = attempt();
  a = applyMove(a, clues, solution, 0, 1, true, true, 2000);
  a = applyMove(a, clues, solution, 0, 2, true, true, 3000);
  a = applyMove(a, clues, solution, 0, 1, false, true, 4000);
  a = applyMove(a, clues, solution, 0, 0, false, true, 5000);
  assert.deepEqual(positionAt(a, 2).notes[0], [1, 2]);
  assert.equal(positionAt(a, 2).board[0], 0);
  assert.equal(positionAt(a, 3).board[0], 1);
  assert.equal(positionAt(a, 3).mistakes, 1);
  assert.deepEqual(positionAt(a, 3).notes[0], []);
  assert.equal(positionAt(a).board[0], 0);
  assert.deepEqual(positionAt(a, 0).board, clues);
  assert.equal(a.moves[3].elapsedMs, 4000);
});
test('givens and no-op inputs do not produce moves; timestamps stay monotonic', () => {
  const a = attempt();
  assert.equal(applyMove(a, clues, solution, 5, 1, false, true, 2000), a);
  assert.equal(applyMove(a, clues, solution, 0, 0, false, true, 2000), a);
  const b = applyMove(a, clues, solution, 0, 1, false, true, 500);
  assert.equal(b.moves[0].at, 1000);
  assert.equal(b.moves[0].elapsedMs, 0);
});
test('completion freezes attempt and duration while history remains readable', () => {
  const almost = solution.slice();
  almost[0] = 0;
  let a = { ...attempt(), initial: initialPosition(almost) };
  a = applyMove(a, almost, solution, 0, solution[0], false, true, 65000);
  assert.equal(a.completedAt, 65000);
  assert.equal(a.durationMs, 64000);
  assert.equal(durationLabel(a.durationMs!), '00:01:04');
  assert.throws(() => applyMove(a, almost, solution, 0, 0, false, true, 70000), /read-only/);
  assert.equal(positionAt(a, 0).board[0], 0);
  assert.deepEqual(positionAt(a, 1).board, solution);
});
test('draft and original image survive storage reads; stale draft writes are rejected', async () => {
  const p = await createPuzzle(clues, new Blob(['photo'], { type: 'image/jpeg' }), [0]);
  assert.ok(p.name);
  assert.ok(p.createdAt > 0);
  const updated = await saveDraft(p, clues, []);
  const reread = (await listPuzzles()).find((x) => x.id === p.id)!;
  assert.deepEqual(reread.clues, clues);
  assert.equal(await reread.image!.text(), 'photo');
  assert.equal(reread.revision, updated.revision);
  await assert.rejects(saveDraft(p, clues, []), /another tab/);
});
test('multiple attempts are independent, reloadable and conflict-protected', async () => {
  const p = await createPuzzle(clues);
  const first = await startAttempt(p);
  let a = await recordMove(first.attempt, 0, 1, true, true);
  const second = await startAttempt(first.puzzle);
  assert.notEqual(a.id, second.attempt.id);
  a = await recordMove(a, 0, 8, false, true);
  const all = await listAttempts(p.id);
  assert.equal(all.length, 2);
  assert.equal(positionAt(all.find((x) => x.id === a.id)!).board[0], 8);
  assert.equal(positionAt(all.find((x) => x.id === second.attempt.id)!).board[0], 0);
  assert.deepEqual(second.attempt.initial.board, clues);
  await assert.rejects(recordMove(first.attempt, 1, 1, false, true), /another tab/);
  await assert.rejects(saveDraft(second.puzzle, clues, []), /another tab/);
});
test('database prevents edits after completion, including a fresh reloaded record', async () => {
  const almost = solution.slice();
  almost[0] = 0;
  const p = await createPuzzle(almost);
  const { attempt: a, puzzle: ready } = await startAttempt(p);
  const finished = await recordMove(a, 0, solution[0], false, true);
  assert.notEqual(finished.completedAt, null);
  assert.equal(finished.durationMs, finished.completedAt! - finished.startedAt);
  const reloaded = (await listAttempts(p.id))[0];
  await assert.rejects(recordMove(reloaded, 0, 0, false, true), /read-only/);
  assert.deepEqual((await listAttempts(p.id))[0], finished);
  const fresh = await startAttempt(ready);
  assert.equal(fresh.attempt.moves.length, 0);
  assert.equal(fresh.attempt.completedAt, null);
});
test('invalid and fully filled puzzles cannot start attempts', async () => {
  await assert.rejects(startAttempt(await createPuzzle()), /17 clues/);
  await assert.rejects(startAttempt(await createPuzzle(solution)), /Leave/);
  const invalid = clues.slice();
  invalid[0] = 5;
  await assert.rejects(startAttempt(await createPuzzle(invalid)), /conflict/);
});

test('renaming persists normalized names without modifying original clues or locked attempts', async () => {
  const { renamePuzzle } = await import('../lib/storage');
  const almost = solution.slice();
  almost[0] = 0;
  const p = await createPuzzle(almost);
  const started = await startAttempt(p);
  const completed = await recordMove(started.attempt, 0, solution[0], false, true);
  const renamed = await renamePuzzle(started.puzzle, '  My   weekend puzzle  ');
  assert.equal(renamed.name, 'My weekend puzzle');
  assert.equal(renamed.createdAt, p.createdAt);
  assert.deepEqual(renamed.clues, almost);
  assert.deepEqual((await listAttempts(p.id))[0], completed);
  assert.equal((await listPuzzles()).find((x) => x.id === p.id)!.name, renamed.name);
  await assert.rejects(renamePuzzle(renamed, '  '), /1 and 80/);
  await assert.rejects(renamePuzzle(renamed, 'x'.repeat(81)), /1 and 80/);
  await assert.rejects(renamePuzzle(started.puzzle, 'Stale name'), /another tab/);
});
