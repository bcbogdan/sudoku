import { applyMove, initialPosition, randomName, type Puzzle, type Attempt } from './attempts';
import { emptyBoard, solve, type Board } from './sudoku';
let connection: Promise<IDBDatabase> | undefined;
function database() {
  if (connection) return connection;
  connection = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('sudoku-local', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore('puzzles', { keyPath: 'id' });
      const attempts = db.createObjectStore('attempts', { keyPath: 'id' });
      attempts.createIndex('puzzleId', 'puzzleId');
    };
    request.onerror = () => reject(request.error ?? new Error('Could not open local storage.'));
    request.onblocked = () =>
      reject(new Error('Close other Sudoku tabs, then reload to open storage.'));
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        connection = undefined;
      };
      resolve(db);
    };
  }).catch((error) => {
    connection = undefined;
    throw error;
  });
  return connection;
}
async function readAll<T>(name: string): Promise<T[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(name, 'readonly'),
      request = tx.objectStore(name).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function listPuzzles() {
  return (await readAll<Puzzle>('puzzles')).sort((a, b) => b.createdAt - a.createdAt);
}
export async function listAttempts(puzzleId?: string) {
  return (await readAll<Attempt>('attempts'))
    .filter((a) => !puzzleId || a.puzzleId === puzzleId)
    .sort((a, b) => b.startedAt - a.startedAt);
}
// Resolve writes only after transaction completion; never present unsaved moves as saved.
async function write<T>(
  stores: string[],
  operation: (tx: IDBTransaction, done: (value: T) => void, fail: (error: Error) => void) => void,
): Promise<T> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, 'readwrite');
    let value: T;
    let error: Error | undefined;
    tx.oncomplete = () => resolve(value);
    tx.onabort = () =>
      reject(
        error ?? tx.error ?? new Error('Could not save. Local storage may be full or unavailable.'),
      );
    tx.onerror = () => {};
    const fail = (e: Error) => {
      error = e;
      tx.abort();
    };
    try {
      operation(
        tx,
        (v) => {
          value = v;
        },
        fail,
      );
    } catch (e) {
      fail(e instanceof Error ? e : new Error('Could not save.'));
    }
  });
}
export async function createPuzzle(
  clues: Board = emptyBoard(),
  image?: Blob,
  uncertain: number[] = [],
): Promise<Puzzle> {
  const now = Date.now(),
    puzzle: Puzzle = {
      id: crypto.randomUUID(),
      name: randomName(),
      createdAt: now,
      updatedAt: now,
      clues: clues.slice(),
      status: 'draft',
      image,
      uncertain,
      revision: 0,
    };
  return write(['puzzles'], (tx, done) => {
    tx.objectStore('puzzles').add(puzzle);
    done(puzzle);
  });
}
export async function saveDraft(
  puzzle: Puzzle,
  clues: Board,
  uncertain: number[],
): Promise<Puzzle> {
  return write(['puzzles'], (tx, done, fail) => {
    const store = tx.objectStore('puzzles'),
      request = store.get(puzzle.id);
    request.onsuccess = () => {
      const current = request.result as Puzzle | undefined;
      if (!current || current.status !== 'draft' || current.revision !== puzzle.revision) {
        fail(new Error('This puzzle changed in another tab. Reload to see its latest state.'));
        return;
      }
      const updated = {
        ...current,
        clues: clues.slice(),
        uncertain,
        updatedAt: Date.now(),
        revision: current.revision + 1,
      };
      store.put(updated);
      done(updated);
    };
  });
}
export async function startAttempt(puzzle: Puzzle): Promise<{ puzzle: Puzzle; attempt: Attempt }> {
  if (puzzle.clues.filter(Boolean).length < 17)
    throw new Error('Add at least 17 clues before starting.');
  if (puzzle.clues.every(Boolean))
    throw new Error('Leave the unprinted cells empty so there is a puzzle to play.');
  const result = solve(puzzle.clues);
  if (result.count !== 1)
    throw new Error(
      result.count === 0
        ? 'These clues conflict or cannot form a solved Sudoku. Please check them.'
        : 'This puzzle has more than one solution. Please check for missing clues.',
    );
  return write(['puzzles', 'attempts'], (tx, done, fail) => {
    const store = tx.objectStore('puzzles'),
      request = store.get(puzzle.id);
    request.onsuccess = () => {
      const current = request.result as Puzzle | undefined;
      if (!current || current.revision !== puzzle.revision) {
        fail(new Error('This puzzle changed in another tab. Reload to continue.'));
        return;
      }
      const now = Date.now(),
        ready: Puzzle = {
          ...current,
          status: 'ready',
          updatedAt: now,
          revision: current.revision + 1,
        };
      const attempt: Attempt = {
        id: crypto.randomUUID(),
        puzzleId: current.id,
        startedAt: now,
        completedAt: null,
        durationMs: null,
        initial: initialPosition(current.clues),
        moves: [],
        revision: 0,
      };
      store.put(ready);
      tx.objectStore('attempts').add(attempt);
      done({ puzzle: ready, attempt });
    };
  });
}
export async function recordMove(
  attempt: Attempt,
  cell: number,
  value: number,
  note: boolean,
  check: boolean,
): Promise<Attempt> {
  return write(['puzzles', 'attempts'], (tx, done, fail) => {
    const store = tx.objectStore('attempts'),
      request = store.get(attempt.id);
    request.onsuccess = () => {
      const current = request.result as Attempt | undefined;
      if (!current || current.revision !== attempt.revision) {
        fail(
          new Error(
            'This attempt changed in another tab. Reload to continue without overwriting it.',
          ),
        );
        return;
      }
      if (current.completedAt !== null) {
        fail(new Error('Completed attempts are read-only.'));
        return;
      }
      const getPuzzle = tx.objectStore('puzzles').get(current.puzzleId);
      getPuzzle.onsuccess = () => {
        try {
          const puzzle = getPuzzle.result as Puzzle | undefined;
          if (!puzzle || puzzle.status !== 'ready') throw new Error('Puzzle is unavailable.');
          const solution = solve(puzzle.clues).solution;
          if (!solution) throw new Error('Invalid puzzle.');
          const updated = applyMove(current, puzzle.clues, solution, cell, value, note, check);
          if (updated !== current) store.put(updated);
          done(updated);
        } catch (error) {
          fail(error instanceof Error ? error : new Error('Could not save move.'));
        }
      };
    };
  });
}

export async function renamePuzzle(puzzle: Puzzle, input: string): Promise<Puzzle> {
  const name = input.trim().replace(/\s+/g, ' ');
  if (!name || name.length > 80) throw new Error('Use a puzzle name between 1 and 80 characters.');
  return write(['puzzles'], (tx, done, fail) => {
    const store = tx.objectStore('puzzles'),
      request = store.get(puzzle.id);
    request.onsuccess = () => {
      const current = request.result as Puzzle | undefined;
      if (!current || current.revision !== puzzle.revision) {
        fail(new Error('This puzzle changed in another tab. Reload before renaming it.'));
        return;
      }
      const updated = { ...current, name, updatedAt: Date.now(), revision: current.revision + 1 };
      store.put(updated);
      done(updated);
    };
  });
}
