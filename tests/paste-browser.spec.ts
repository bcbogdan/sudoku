import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import expected from './fixtures/expected.json';

for (const method of ['paste event', 'paste button'] as const) {
  test(`${method} imports the original photo into a saved draft`, async ({ page }) => {
    const bytes = Array.from(await readFile('tests/fixtures/original.jpeg'));
    await page.goto('/?new');
    await expect(page.getByRole('button', { name: 'Paste image', exact: true })).toBeVisible();
    await page.evaluate(
      ({ bytes, method }) => {
        const file = new File([new Uint8Array(bytes)], 'clipboard.jpeg', { type: 'image/jpeg' });
        if (method === 'paste event') {
          const clipboardData = new DataTransfer();
          clipboardData.items.add(file);
          document.dispatchEvent(
            new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }),
          );
        } else {
          Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: {
              read: async () => [{ types: [file.type], getType: async () => file }],
            },
          });
        }
      },
      { bytes, method },
    );
    if (method === 'paste button')
      await page.getByRole('button', { name: 'Paste image', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Confirm clues & play' })).toBeVisible({
      timeout: 150000,
    });
    await expect(page).toHaveURL(/\?puzzle=/);
    await page.reload();
    await expect(page.locator('.cell')).toHaveCount(81);
    const board = await page
      .locator('.cell')
      .evaluateAll((cells) => cells.map((cell) => Number(cell.getAttribute('data-value'))));
    expect(board).toEqual(expected);
  });
}

test('clipboard errors are actionable and text paste is left alone', async ({ page }) => {
  await page.goto('/?new');
  const button = page.getByRole('button', { name: 'Paste image', exact: true });
  await expect(button).toBeVisible();
  expect(
    await page.evaluate(() => {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', 'ordinary text');
      return document.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true }),
      );
    }),
  ).toBe(true);
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { read: async () => [] },
    }),
  );
  await button.click();
  await expect(
    page.getByText('No image on the clipboard. Copy an image, then paste again.', { exact: true }),
  ).toBeVisible();
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        read: async () => {
          throw new DOMException('Denied', 'NotAllowedError');
        },
      },
    }),
  );
  await button.click();
  await expect(
    page.getByText(
      'Clipboard access was not available. Allow access, use Paste, or choose a photo.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(button).toBeEnabled();
});
