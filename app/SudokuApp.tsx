'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useFocusTimer } from '@/lib/use-focus-timer';
import { puzzleShareURL } from '@/lib/sharing';
import { peers, solve } from '@/lib/sudoku';
import {
  durationLabel,
  initialPosition,
  positionAt,
  type Attempt,
  type Puzzle,
} from '@/lib/attempts';
import {
  createPuzzle,
  importSharedPuzzle,
  removePuzzle,
  listAttempts,
  listPuzzles,
  recordMove,
  renamePuzzle,
  saveDraft,
  startAttempt,
} from '@/lib/storage';

function puzzleURL(id: string) {
  return `/?puzzle=${encodeURIComponent(id)}`;
}
function attemptURL(puzzleId: string, id: string) {
  return `${puzzleURL(puzzleId)}&attempt=${encodeURIComponent(id)}`;
}
function dateLabel(value: number) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function Sudoku() {
  const [loaded, setLoaded] = useState(false),
    [screen, setScreen] = useState<'library' | 'create' | 'review' | 'detail' | 'play'>('library');
  const [puzzles, setPuzzles] = useState<Puzzle[]>([]),
    [attempts, setAttempts] = useState<Attempt[]>([]);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null),
    [attempt, setAttempt] = useState<Attempt | null>(null);
  const [step, setStep] = useState(0),
    [selected, setSelected] = useState(0),
    [notesMode, setNotesMode] = useState(false),
    [check, setCheck] = useState(true);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const saving = useRef(false);
  const [shareLink, setShareLink] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  const [editingName, setEditingName] = useState(false),
    [nameValue, setNameValue] = useState('');
  useEffect(() => {
    let cancelled = false;
    Promise.all([listPuzzles(), listAttempts()])
      .then(async ([saved, plays]) => {
        if (cancelled) return;
        setPuzzles(saved);
        setAttempts(plays);

        const query = new URLSearchParams(window.location.search),
          id = query.get('puzzle'),
          attemptId = query.get('attempt');
        if (query.has('p')) {
          const imported = await importSharedPuzzle(query.get('p')!, query.get('n'));
          if (cancelled) return;
          setPuzzle(imported);
          setPuzzles(await listPuzzles());
          setScreen(imported.status === 'draft' ? 'review' : 'detail');
          window.history.replaceState(null, '', puzzleURL(imported.id));
          return;
        }
        if (query.has('new')) setScreen('create');
        else if (id) {
          const p = saved.find((p) => p.id === id);
          if (!p) {
            setMessage('This puzzle is not saved in this browser.');
            return;
          }
          setPuzzle(p);
          if (attemptId) {
            const a = plays.find((a) => a.id === attemptId && a.puzzleId === id);
            if (!a) {
              setMessage('This attempt is unavailable.');
              setScreen('detail');
              return;
            }
            setAttempt(a);
            setStep(a.moves.length);
            setSelected(
              Math.max(
                0,
                p.clues.findIndex((v) => !v),
              ),
            );
            setScreen('play');
          } else setScreen(p.status === 'draft' ? 'review' : 'detail');
        }
      })
      .catch((error) => {
        if (!cancelled)
          setMessage(error instanceof Error ? error.message : 'Local storage is unavailable.');
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const focusTimer = useFocusTimer(attempt, setMessage);
  const solution = useMemo(
    () => (puzzle?.status === 'ready' ? solve(puzzle.clues).solution : null),
    [puzzle],
  );
  const position = attempt
    ? positionAt(attempt, step)
    : puzzle
      ? initialPosition(puzzle.clues)
      : null;
  const board = position?.board ?? [];
  const historical = !!attempt && step < attempt.moves.length,
    complete = attempt?.completedAt !== null && !!attempt;
  const readOnly = historical || complete;
  const elapsed = attempt
    ? historical
      ? step
        ? attempt.moves[step - 1].elapsedMs
        : 0
      : (attempt.durationMs ?? focusTimer.elapsed)
    : 0;
  async function action(work: () => Promise<void>) {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setMessage('');
    try {
      await work();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save. Please try again.');
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  async function upload(file?: File) {
    if (!file) return;
    await action(async () => {
      if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
      if (file.size > 20 * 1024 * 1024) throw new Error('Please use an image smaller than 20 MB.');
      const { readSudoku } = await import('@/lib/localSudokuReader');
      const result = await readSudoku(file, setMessage);
      const saved = await createPuzzle(result.board, file, result.uncertain);
      window.location.assign(puzzleURL(saved.id));
    });
  }
  async function begin() {
    if (!puzzle) return;
    await action(async () => {
      const result = await startAttempt(puzzle);
      window.location.assign(attemptURL(result.puzzle.id, result.attempt.id));
    });
  }
  async function enter(value: number) {
    if (!puzzle || readOnly || saving.current || (screen === 'play' && puzzle.clues[selected]))
      return;
    await action(async () => {
      if (screen === 'review') {
        const clues = puzzle.clues.map((v, i) => (i === selected ? value : v));
        const updated = await saveDraft(
          puzzle,
          clues,
          puzzle.uncertain.filter((i) => i !== selected),
        );
        setPuzzle(updated);
      } else if (attempt) {
        await focusTimer.flush();
        const updated = await recordMove(attempt, selected, value, notesMode, check);
        setAttempt(updated);
        setStep(updated.moves.length);
      }
    });
  }
  async function removeCurrentPuzzle() {
    if (!puzzle || saving.current) return;
    if (
      !window.confirm(
        `Remove “${puzzle.name}” and all its attempts from this device? This cannot be undone.`,
      )
    )
      return;
    await action(async () => {
      await removePuzzle(puzzle);
      window.location.assign('/');
    });
  }
  const puzzleActions = puzzle ? (
    <div className="puzzle-actions">
      <button
        className="secondary"
        disabled={busy}
        onClick={() => {
          try {
            setShareLink(puzzleShareURL(window.location.origin, puzzle.clues, puzzle.name));
            setCopyMessage('');
          } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Could not share this puzzle.');
          }
        }}
      >
        Share puzzle
      </button>
      <button
        className="secondary remove-button"
        disabled={busy}
        onClick={() => void removeCurrentPuzzle()}
      >
        Remove puzzle
      </button>
    </div>
  ) : null;
  const header = (
    <header>
      <a href="/" className="brand">
        <span aria-hidden="true">▦</span> Sudoku
      </a>
      <nav>
        <a href="/" aria-current={screen === 'library' ? 'page' : undefined}>
          My puzzles
        </a>
        <a href="/?new" aria-current={screen === 'create' ? 'page' : undefined}>
          New puzzle
        </a>
      </nav>
    </header>
  );
  const puzzleTitle = puzzle ? (
    editingName ? (
      <form
        className="name-editor"
        onSubmit={(e) => {
          e.preventDefault();
          void action(async () => {
            const updated = await renamePuzzle(puzzle, nameValue);
            setPuzzle(updated);
            setPuzzles((old) => old.map((p) => (p.id === updated.id ? updated : p)));
            setEditingName(false);
          });
        }}
      >
        <label htmlFor="puzzle-name">Puzzle name</label>
        <input
          id="puzzle-name"
          autoFocus
          value={nameValue}
          maxLength={80}
          required
          disabled={busy}
          onChange={(e) => setNameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              setEditingName(false);
            }
          }}
        />
        <div>
          <button className="primary" disabled={busy || !nameValue.trim()} type="submit">
            Save name
          </button>
          <button
            className="secondary"
            disabled={busy}
            type="button"
            onClick={() => setEditingName(false)}
          >
            Cancel
          </button>
        </div>
      </form>
    ) : (
      <div className="puzzle-title">
        <h1>{puzzle.name}</h1>
        <button
          className="rename-button"
          aria-label="Rename puzzle"
          title="Rename puzzle"
          disabled={busy}
          onClick={() => {
            setNameValue(puzzle.name);
            setEditingName(true);
          }}
        >
          ✎
        </button>
      </div>
    )
  ) : null;
  if (!loaded)
    return (
      <main>
        {header}
        <p className="status" role="status">
          Opening your puzzles…
        </p>
      </main>
    );
  return (
    <main className={screen === 'play' || screen === 'review' ? 'board-screen' : ''}>
      {header}
      {screen === 'library' ? (
        <section className="library">
          <div className="section-heading">
            <div>
              <p className="eyebrow">YOUR COLLECTION</p>
              <h1>My puzzles</h1>
            </div>
            <a className="primary" href="/?new">
              ＋ New puzzle
            </a>
          </div>
          {puzzles.length === 0 ? (
            <div className="empty-state">
              <span aria-hidden="true">▦</span>
              <h2>A place for every puzzle.</h2>
              <p>Choose a photo or enter clues to start your collection.</p>
              <a href="/?new" className="primary">
                Create a puzzle
              </a>
            </div>
          ) : (
            <div className="puzzle-list">
              {puzzles.map((p) => {
                const plays = attempts.filter((a) => a.puzzleId === p.id),
                  finished = plays.filter((a) => a.completedAt !== null);
                return (
                  <a
                    className="puzzle-card"
                    key={p.id}
                    href={plays[0] ? attemptURL(p.id, plays[0].id) : puzzleURL(p.id)}
                  >
                    <div className="mini-board" aria-hidden="true">
                      {p.clues.map((v, i) => (
                        <span key={i}>{v || ''}</span>
                      ))}
                    </div>
                    <div>
                      <span className="badge">
                        {p.status === 'draft' ? 'Draft' : `${finished.length} completed`}
                      </span>
                      <h2>{p.name}</h2>
                      <p>{dateLabel(p.createdAt)}</p>
                      <p>
                        {p.clues.filter(Boolean).length} clues · {plays.length}{' '}
                        {plays.length === 1 ? 'attempt' : 'attempts'}
                      </p>
                    </div>
                    <span className="card-arrow" aria-hidden="true">
                      ↗
                    </span>
                  </a>
                );
              })}
            </div>
          )}
          <p className="storage-note">
            Saved in this browser on this device. Clearing browser data removes your puzzles and
            attempts.
          </p>
        </section>
      ) : null}
      {screen === 'create' ? (
        <section className="create-screen">
          <p className="eyebrow">ADD TO YOUR COLLECTION</p>
          <h1>A new puzzle.</h1>
          <p>Start with a photo, or enter the printed clues yourself.</p>
          <label
            className="upload"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void upload(e.dataTransfer.files[0]);
            }}
          >
            <span aria-hidden="true">＋</span>
            <strong>{busy ? 'Reading your photo…' : 'Choose a Sudoku photo'}</strong>
            <small>or drop an image here · up to 20 MB</small>
            <input
              aria-label="Choose a Sudoku photo"
              type="file"
              accept="image/*"
              disabled={busy}
              onChange={(e) => {
                void upload(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
          <button
            disabled={busy}
            className="secondary"
            onClick={() =>
              void action(async () => {
                const p = await createPuzzle();
                window.location.assign(puzzleURL(p.id));
              })
            }
          >
            Enter clues by hand
          </button>
          <p className="storage-note">Photos are processed and saved on your device.</p>
        </section>
      ) : null}
      {screen === 'detail' && puzzle ? (
        <section className="library">
          <a className="back" href="/">
            ← My puzzles
          </a>
          <div className="section-heading">
            <div>
              <p className="eyebrow">{dateLabel(puzzle.createdAt)}</p>
              {puzzleTitle}
              <p>{puzzle.clues.filter(Boolean).length} original clues</p>
            </div>
            <button className="primary" disabled={busy} onClick={() => void begin()}>
              ＋ New attempt
            </button>
          </div>
          {puzzleActions}
          <h2>Attempts</h2>
          <div className="attempt-list">
            {attempts
              .filter((a) => a.puzzleId === puzzle.id)
              .map((a, i, all) => (
                <a href={attemptURL(puzzle.id, a.id)} key={a.id} className="attempt-row">
                  <div>
                    <strong>Attempt {all.length - i}</strong>
                    <p>Started {dateLabel(a.startedAt)}</p>
                  </div>
                  <span className="badge">
                    {a.completedAt !== null ? 'Completed' : 'In progress'}
                  </span>
                  <span>{a.moves.length} moves</span>
                  <span>{a.durationMs !== null ? durationLabel(a.durationMs) : 'Resume →'}</span>
                </a>
              ))}
          </div>
          {!attempts.some((a) => a.puzzleId === puzzle.id) ? (
            <p>No attempts yet. Start a fresh one whenever you’re ready.</p>
          ) : null}
          <p className="storage-note">
            Duration counts only while the attempt page is focused and visible. Completed attempts
            remain available to replay.
          </p>
        </section>
      ) : null}
      {(screen === 'play' || screen === 'review') && puzzle && position ? (
        <section className="play-surface" aria-label="Sudoku game">
          <div className="play-heading">
            <div>
              <a className="back" href={screen === 'play' ? puzzleURL(puzzle.id) : '/'}>
                ← {screen === 'play' ? 'All attempts' : 'My puzzles'}
              </a>
              {puzzleTitle}
            </div>
            <div className="play-meta">
              {attempt ? (
                <>
                  <span className="badge">
                    {complete ? 'Completed' : historical ? 'Viewing history' : 'In progress'}
                  </span>
                  <time aria-label="Attempt duration">{durationLabel(elapsed)}</time>
                </>
              ) : (
                <span className="badge">Review clues · Draft saved</span>
              )}
            </div>
          </div>
          {screen === 'review' ? (
            <div className="review-toolbar">
              <span>
                {board.filter(Boolean).length} clues · Check the numbers before playing.
                {puzzle.uncertain.length ? ` ${puzzle.uncertain.length} cells need review.` : ''}
              </span>
              <button className="primary" disabled={busy} onClick={() => void begin()}>
                Confirm clues & play →
              </button>
            </div>
          ) : (
            <div className="play-toolbar">
              <button
                className="secondary"
                aria-pressed={notesMode}
                disabled={readOnly || busy}
                onClick={() => setNotesMode((v) => !v)}
              >
                Pencil notes {notesMode ? 'On' : 'Off'}
              </button>
              <button
                className="secondary"
                aria-pressed={check}
                onClick={() => setCheck((v) => !v)}
              >
                Mistake check {check ? 'On' : 'Off'}
              </button>
              <span className="mistakes">Mistakes {position.mistakes}</span>
              <span className="save-state">{busy ? 'Saving…' : 'Saved'}</span>
            </div>
          )}
          <div className="board-wrap">
            <div
              className="board"
              role="group"
              aria-label="Sudoku board"
              onKeyDown={(e) => {
                if (/^[1-9]$/.test(e.key)) {
                  e.preventDefault();
                  void enter(Number(e.key));
                } else if (['Backspace', 'Delete', '0'].includes(e.key)) {
                  e.preventDefault();
                  void enter(0);
                } else if (e.key.toLowerCase() === 'n' && !readOnly) {
                  setNotesMode((v) => !v);
                } else {
                  const delta: Record<string, number> = {
                    ArrowUp: -9,
                    ArrowDown: 9,
                    ArrowLeft: -1,
                    ArrowRight: 1,
                  };
                  if (e.key in delta) {
                    e.preventDefault();
                    const next = Math.max(0, Math.min(80, selected + delta[e.key]));
                    setSelected(next);
                    document.getElementById(`cell-${next}`)?.focus();
                  }
                }
              }}
            >
              {board.map((value, i) => {
                const given = screen === 'play' && !!puzzle.clues[i],
                  wrong = screen === 'play' && check && value && !given && solution?.[i] !== value;
                return (
                  <button
                    key={i}
                    id={`cell-${i}`}
                    type="button"
                    data-value={value}
                    data-given={given}
                    data-wrong={!!wrong}
                    aria-label={`Row ${Math.floor(i / 9) + 1} column ${(i % 9) + 1}, ${value || 'empty'}${given ? ', given' : ''}`}
                    aria-pressed={selected === i}
                    tabIndex={selected === i ? 0 : -1}
                    className={`cell ${given ? 'given' : ''} ${peers(selected, i) ? 'peer' : ''} ${value && value === board[selected] ? 'match' : ''} ${selected === i ? 'selected' : ''} ${wrong ? 'wrong' : ''} ${screen === 'review' && puzzle.uncertain.includes(i) ? 'uncertain' : ''}`}
                    onClick={() => setSelected(i)}
                  >
                    {value || (
                      <span className="notes">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                          <span key={n} className={board[selected] === n ? 'note-match' : ''}>
                            {position.notes[i].includes(n) ? n : ''}
                          </span>
                        ))}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {!complete ? (
              <div className="keypad">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => (
                  <button
                    key={n}
                    aria-label={n ? `Enter ${n}` : 'Erase cell'}
                    disabled={readOnly || busy}
                    onClick={() => void enter(n)}
                  >
                    {n || '⌫'}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {attempt ? (
            <div className="history">
              <div className="history-buttons">
                <button
                  className="secondary"
                  aria-label="First move"
                  disabled={step === 0 || busy}
                  onClick={() => setStep(0)}
                >
                  ↤
                </button>
                <button
                  className="secondary"
                  aria-label="Previous move"
                  disabled={step === 0 || busy}
                  onClick={() => setStep((v) => v - 1)}
                >
                  ←
                </button>
                <label>
                  Move {step} of {attempt.moves.length}
                  <input
                    aria-label="Attempt history"
                    type="range"
                    min="0"
                    max={attempt.moves.length}
                    value={step}
                    disabled={busy || !attempt.moves.length}
                    onChange={(e) => setStep(Number(e.target.value))}
                  />
                </label>
                <button
                  className="secondary"
                  aria-label="Next move"
                  disabled={step === attempt.moves.length || busy}
                  onClick={() => setStep((v) => v + 1)}
                >
                  →
                </button>
                <button
                  className="secondary"
                  aria-label="Latest move"
                  disabled={step === attempt.moves.length || busy}
                  onClick={() => setStep(attempt.moves.length)}
                >
                  ↦
                </button>
              </div>
              <p>
                {step
                  ? `${attempt.moves[step - 1].kind === 'note' ? 'Pencil note' : attempt.moves[step - 1].value ? 'Number entered' : 'Cell erased'} · Row ${Math.floor(attempt.moves[step - 1].cell / 9) + 1}, column ${(attempt.moves[step - 1].cell % 9) + 1} · ${dateLabel(attempt.moves[step - 1].at)}`
                  : 'Original puzzle'}
                {historical
                  ? ' · History is read-only. Return to the latest move to continue.'
                  : ''}
              </p>
              {complete ? (
                <div className="completion">
                  <strong>
                    Completed in {durationLabel(attempt.durationMs!)}. This attempt is locked.
                  </strong>
                  <button className="primary" disabled={busy} onClick={() => void begin()}>
                    Start a new attempt
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="hint">
              Select a square, then use 1–9 or Delete. Your draft saves automatically.
            </p>
          )}
        </section>
      ) : null}
      {screen === 'play' || screen === 'review' ? puzzleActions : null}
      {shareLink ? (
        <section className="share-panel" aria-label="Share puzzle link">
          <div>
            <h2>Share this puzzle</h2>
            <button className="secondary" onClick={() => setShareLink('')}>
              Close share link
            </button>
          </div>
          <p>
            Only the original clues and name are shared. Opening the link saves a copy in the
            recipient’s browser.
          </p>
          <label htmlFor="share-link">Puzzle link</label>
          <input id="share-link" readOnly value={shareLink} onFocus={(e) => e.target.select()} />
          <button
            className="primary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(shareLink);
                setCopyMessage('Link copied.');
              } catch {
                setCopyMessage('Select the link above and copy it manually.');
              }
            }}
          >
            Copy link
          </button>
          <span role="status">{copyMessage}</span>
        </section>
      ) : null}
      <p className="status" role="status" aria-live="polite">
        {message}
      </p>
    </main>
  );
}
