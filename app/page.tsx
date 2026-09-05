import type { Metadata } from 'next';
import SudokuApp from './SudokuApp';
import { decodeSharedPuzzle, encodePuzzle } from '@/lib/sharing';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const query = await searchParams;
  if (typeof query.p !== 'string') return {};
  try {
    const puzzle = decodeSharedPuzzle(query.p, typeof query.n === 'string' ? query.n : null);
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : `http://localhost:${process.env.PORT || '3000'}`);
    const image = new URL(
      `/api/puzzle-preview?p=${encodeURIComponent(encodePuzzle(puzzle.clues))}`,
      origin,
    ).toString();
    return {
      title: puzzle.name,
      description: 'Open this Sudoku and play your own attempt.',
      openGraph: {
        title: puzzle.name,
        description: 'Open this Sudoku and play your own attempt.',
        type: 'website',
        images: [{ url: image, width: 630, height: 630, alt: 'The original Sudoku clues' }],
      },
      twitter: { card: 'summary_large_image', title: puzzle.name, images: [image] },
    };
  } catch {
    return { title: 'Invalid puzzle link', robots: { index: false, follow: false } };
  }
}
export default function Page() {
  return <SudokuApp />;
}
