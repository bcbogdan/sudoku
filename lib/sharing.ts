import { validBoard, type Board } from './sudoku';

export function encodePuzzle(clues: Board): string {
  if (!validBoard(clues)) throw new Error('Correct conflicting clues before sharing this puzzle.');
  return btoa(clues.join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function decodeSharedPuzzle(encoded: string, rawName: string | null) {
  if (!/^[A-Za-z0-9_-]{108}$/.test(encoded)) throw new Error('This puzzle link is invalid.');
  let digits: string;
  try {
    digits = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
  } catch {
    throw new Error('This puzzle link is invalid.');
  }
  if (!/^[0-9]{81}$/.test(digits)) throw new Error('This puzzle link is invalid.');
  const clues = Array.from(digits, Number);
  if (!validBoard(clues)) throw new Error('This puzzle link contains conflicting clues.');
  const name = (rawName ?? 'Shared puzzle').trim().replace(/\s+/g, ' ');
  if (!name || name.length > 80)
    throw new Error('The shared puzzle name must be between 1 and 80 characters.');
  return { clues, name, shareKey: JSON.stringify([encoded, name]) };
}
export function puzzleShareURL(origin: string, clues: Board, name: string) {
  const url = new URL('/', origin);
  url.searchParams.set('p', encodePuzzle(clues));
  url.searchParams.set('n', name);
  return url.toString();
}
