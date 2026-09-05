import { ImageResponse } from 'next/og';
import { decodeSharedPuzzle } from '@/lib/sharing';

export async function GET(request: Request) {
  let clues: number[];
  try {
    clues = decodeSharedPuzzle(new URL(request.url).searchParams.get('p') ?? '', null).clues;
  } catch {
    return new Response('Invalid puzzle', { status: 400 });
  }
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#ffffff',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', border: '3px solid #17221b' }}>
        {Array.from({ length: 9 }, (_, r) => (
          <div key={r} style={{ display: 'flex' }}>
            {Array.from({ length: 9 }, (_, c) => (
              <div
                key={c}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 66,
                  height: 66,
                  boxSizing: 'border-box',
                  fontSize: 38,
                  color: '#17221b',
                  fontWeight: 700,
                  borderRight: c === 8 ? '0' : `${c % 3 === 2 ? 3 : 1}px solid #17221b`,
                  borderBottom: r === 8 ? '0' : `${r % 3 === 2 ? 3 : 1}px solid #17221b`,
                }}
              >
                {clues[r * 9 + c] ? String(clues[r * 9 + c]) : ''}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>,
    {
      width: 630,
      height: 630,
      headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' },
    },
  );
}
