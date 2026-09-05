import { validBoard, type Board } from './sudoku';
export type Puzzle = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  clues: Board;
  status: 'draft' | 'ready';
  image?: Blob;
  uncertain: number[];
  revision: number;
  shareKey?: string;
};
export type Position = { board: Board; notes: number[][]; mistakes: number };
export type Move = {
  cell: number;
  kind: 'entry' | 'note';
  value: number;
  at: number;
  elapsedMs: number;
  position: Position;
};
export type Attempt = {
  id: string;
  puzzleId: string;
  startedAt: number;
  completedAt: number | null;
  durationMs: number | null;
  activeMs?: number;
  lastActiveEnd?: number;
  initial: Position;
  moves: Move[];
  revision: number;
};
export function initialPosition(clues: Board): Position {
  return { board: clues.slice(), notes: Array.from({ length: 81 }, () => []), mistakes: 0 };
}
export function positionAt(attempt: Attempt, step = attempt.moves.length): Position {
  if (!Number.isInteger(step) || step < 0 || step > attempt.moves.length)
    throw new Error('Invalid history position.');
  return step === 0 ? attempt.initial : attempt.moves[step - 1].position;
}
export function applyMove(
  attempt: Attempt,
  clues: Board,
  solution: Board,
  cell: number,
  value: number,
  note: boolean,
  check: boolean,
  now = Date.now(),
): Attempt {
  if (attempt.completedAt !== null)
    throw new Error('Completed attempts are read-only. Start a new attempt to play again.');
  if (
    !Number.isInteger(cell) ||
    cell < 0 ||
    cell > 80 ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 9
  )
    throw new Error('Invalid move.');
  if (clues[cell]) return attempt;
  const old = positionAt(attempt),
    position: Position = structuredClone(old);
  if (note && value) {
    if (position.board[cell]) return attempt;
    const notes = position.notes[cell];
    position.notes[cell] = notes.includes(value)
      ? notes.filter((n) => n !== value)
      : [...notes, value].sort();
  } else {
    if (position.board[cell] === value && !position.notes[cell].length) return attempt;
    if (check && value && value !== solution[cell] && old.board[cell] !== value)
      position.mistakes++;
    position.board[cell] = value;
    position.notes[cell] = [];
  }
  const at = Math.max(now, attempt.startedAt, attempt.moves.at(-1)?.at ?? 0),
    elapsedMs = attempt.activeMs ?? at - attempt.startedAt;
  const complete = position.board.every(Boolean) && validBoard(position.board);
  return {
    ...attempt,
    revision: attempt.revision + 1,
    completedAt: complete ? at : null,
    durationMs: complete ? elapsedMs : null,
    moves: [
      ...attempt.moves,
      { cell, kind: note && value ? 'note' : 'entry', value, at, elapsedMs, position },
    ],
  };
}
export function durationLabel(ms: number) {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  return `${Math.floor(seconds / 3600)
    .toString()
    .padStart(2, '0')}:${Math.floor((seconds % 3600) / 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}
export function randomName() {
  const adjectives = ['Quiet', 'Amber', 'Misty', 'Silver', 'Golden', 'Gentle', 'Brisk', 'Hidden'];
  const nouns = ['Meadow', 'Maple', 'Harbor', 'Orchid', 'Willow', 'Cove', 'Summit', 'Fern'];
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return `${adjectives[bytes[0] % adjectives.length]} ${nouns[bytes[1] % nouns.length]} ${((bytes[2] << 8) | bytes[3]).toString(16).padStart(4, '0').toUpperCase()}`;
}

// Legacy unfinished attempts retain only time recorded at their last move.
// We cannot reconstruct past focus, so never charge the gap since that move.
export function activeDuration(attempt: Attempt): number {
  return attempt.durationMs ?? attempt.activeMs ?? attempt.moves.at(-1)?.elapsedMs ?? 0;
}
export function addActiveInterval(attempt: Attempt, start: number, end: number): Attempt {
  if (attempt.completedAt !== null) return attempt;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start)
    throw new Error('Invalid active interval.');
  const from = Math.max(start, attempt.lastActiveEnd ?? start);
  return {
    ...attempt,
    activeMs: activeDuration(attempt) + Math.max(0, end - from),
    lastActiveEnd: Math.max(end, attempt.lastActiveEnd ?? end),
  };
}
