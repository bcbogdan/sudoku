export type ActiveInterval = { start: number; end: number };
// Checkpoint on focus/visibility transitions so hidden time never enters a slice.
export class FocusClock {
  private start: number | null = null;
  setFocused(focused: boolean, now: number): ActiveInterval | null {
    const interval = this.checkpoint(now);
    this.start = focused ? now : null;
    return interval;
  }
  checkpoint(now: number): ActiveInterval | null {
    if (this.start === null) return null;
    const start = this.start,
      end = Math.max(start, now);
    this.start = end;
    return end > start ? { start, end } : null;
  }
}
