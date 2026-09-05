import { validBoard, type Board } from './sudoku';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const radix = BigInt(64);

// Treat the fixed-size board as one decimal integer instead of Base64-encoding
// 81 ASCII characters. Decode restores leading empty cells to the known length.
export function encodePuzzle(clues: Board): string {
  if (!validBoard(clues)) throw new Error('Correct conflicting clues before sharing this puzzle.');
  let value = BigInt(clues.join(''));
  let packed = '';
  do {
    packed = alphabet[Number(value % radix)] + packed;
    value /= radix;
  } while (value > BigInt(0));
  return `1.${packed}`;
}
export function decodeSharedPuzzle(encoded: string, rawName: string | null) {
  let digits: string;
  if (/^1\.[A-Za-z0-9_-]{1,45}$/.test(encoded)) {
    let value = BigInt(0);
    for (const character of encoded.slice(2))
      value = value * radix + BigInt(alphabet.indexOf(character));
    digits = value.toString().padStart(81, '0');
  } else if (/^[A-Za-z0-9_-]{108}$/.test(encoded)) {
    // Previously issued ASCII/Base64 links remain valid.
    try {
      digits = atob(encoded.replace(/-/g, '+').replace(/_/g, '/'));
    } catch {
      throw new Error('This puzzle link is invalid.');
    }
  } else {
    throw new Error('This puzzle link is invalid.');
  }
  if (!/^[0-9]{81}$/.test(digits)) throw new Error('This puzzle link is invalid.');
  const clues = Array.from(digits, Number);
  if (!validBoard(clues)) throw new Error('This puzzle link contains conflicting clues.');
  const name = (rawName ?? 'Shared puzzle').trim().replace(/\s+/g, ' ');
  if (!name || name.length > 80)
    throw new Error('The shared puzzle name must be between 1 and 80 characters.');
  return {
    clues,
    name,
    shareKey: JSON.stringify([digits, name]),
    legacyShareKey: JSON.stringify([btoa(digits), name]),
  };
}
export function puzzleShareURL(origin: string, clues: Board, name: string) {
  const url = new URL('/', origin);
  url.searchParams.set('p', encodePuzzle(clues));
  url.searchParams.set('n', name);
  return url.toString();
}
