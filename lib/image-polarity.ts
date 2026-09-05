// Estimate the cell background from the middle of the image, excluding its frame.
// Sparse digits and colored selection highlights should not decide the polarity.
export function hasDarkBackground(gray: Uint8Array, width: number, height: number): boolean {
  let dark = 0;
  let samples = 0;
  const insetX = Math.floor(width * 0.1);
  const insetY = Math.floor(height * 0.1);
  const step = Math.max(1, Math.floor(Math.min(width, height) / 200));
  for (let y = insetY; y < height - insetY; y += step) {
    for (let x = insetX; x < width - insetX; x += step) {
      if (gray[y * width + x] < 128) dark++;
      samples++;
    }
  }
  return samples > 0 && dark > samples / 2;
}
