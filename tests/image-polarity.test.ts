import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasDarkBackground } from '../lib/image-polarity';

test('white digits and selection highlights do not hide a dark background', () => {
  const pixels = new Uint8Array(100 * 100).fill(17);
  for (let y = 10; y < 90; y++) for (let x = 10; x < 30; x++) pixels[y * 100 + x] = 170;
  for (let y = 20; y < 80; y += 10) for (let x = 40; x < 80; x++) pixels[y * 100 + x] = 250;
  assert.equal(hasDarkBackground(pixels, 100, 100), true);
});

test('dark frame and sparse printed clues do not invert a paper board', () => {
  const pixels = new Uint8Array(100 * 100);
  for (let y = 10; y < 90; y++) for (let x = 10; x < 90; x++) pixels[y * 100 + x] = 230;
  for (let y = 20; y < 80; y += 10) for (let x = 40; x < 80; x++) pixels[y * 100 + x] = 15;
  assert.equal(hasDarkBackground(pixels, 100, 100), false);
});
