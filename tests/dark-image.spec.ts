import { test, expect } from '@playwright/test';
import path from 'node:path';
import expected from './fixtures/dark-highlighted.json';

test('dark screenshot with highlighted cells preserves all 22 clues and empty cells', async ({
  page,
}) => {
  await page.goto('/?new');
  await page
    .getByLabel('Choose a Sudoku photo', { exact: true })
    .setInputFiles(path.resolve('tests/fixtures/dark-highlighted.jpeg'));
  await expect(page.getByRole('button', { name: 'Confirm clues & play' })).toBeVisible({
    timeout: 150000,
  });
  const board = await page
    .locator('.cell')
    .evaluateAll((cells) => cells.map((cell) => Number(cell.getAttribute('data-value'))));
  expect(board).toEqual(expected);
  expect(board.filter(Boolean)).toHaveLength(22);
});
