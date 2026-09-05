'use client';
import { useEffect, useRef, useState } from 'react';
import { activeDuration, type Attempt } from './attempts';
import { FocusClock, type ActiveInterval } from './focus-clock';
import { saveActiveInterval } from './storage';

export function useFocusTimer(attempt: Attempt | null, onError: (message: string) => void) {
  const [elapsed, setElapsed] = useState(0);
  const flushRef = useRef<() => Promise<void>>(async () => {});
  const errorRef = useRef(onError);
  errorRef.current = onError;
  useEffect(() => {
    if (!attempt) return;
    setElapsed(activeDuration(attempt));
    if (attempt.completedAt !== null) {
      flushRef.current = async () => {};
      return;
    }
    const clock = new FocusClock();
    let disposed = false;
    let queue = Promise.resolve();
    const pending: ActiveInterval[] = [];
    let lastError: unknown;
    const save = (interval: ReturnType<FocusClock['checkpoint']>) => {
      if (interval) pending.push(interval);
      queue = queue
        .then(async () => {
          while (pending.length) {
            const next = pending[0];
            const saved = await saveActiveInterval(attempt.id, next.start, next.end);
            pending.shift();
            if (saved && !disposed) setElapsed(activeDuration(saved));
          }
          lastError = undefined;
        })
        .catch((error) => {
          lastError = error;
          if (!disposed)
            errorRef.current(error instanceof Error ? error.message : 'Could not save timer.');
        });
      return queue;
    };
    const focused = () => document.visibilityState === 'visible' && document.hasFocus();
    const transition = () => {
      void save(clock.setFocused(focused(), Date.now()));
    };
    const pause = () => {
      void save(clock.setFocused(false, Date.now()));
    };
    flushRef.current = async () => {
      await save(clock.checkpoint(Date.now()));
      if (pending.length) throw lastError ?? new Error('Could not save timer.');
    };
    transition();
    const timer = setInterval(() => {
      void save(clock.checkpoint(Date.now()));
    }, 1000);
    window.addEventListener('focus', transition);
    window.addEventListener('blur', pause);
    document.addEventListener('visibilitychange', transition);
    window.addEventListener('pagehide', pause);
    window.addEventListener('pageshow', transition);
    return () => {
      pause();
      disposed = true;
      clearInterval(timer);
      window.removeEventListener('focus', transition);
      window.removeEventListener('blur', pause);
      document.removeEventListener('visibilitychange', transition);
      window.removeEventListener('pagehide', pause);
      window.removeEventListener('pageshow', transition);
      flushRef.current = async () => {};
    };
  }, [attempt?.id, attempt?.completedAt]);
  return { elapsed, flush: () => flushRef.current() };
}
