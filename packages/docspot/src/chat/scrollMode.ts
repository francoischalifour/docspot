/**
 * How the transcript scrolls. It follows the end while an answer grows,
 * anchors a streamed answer's start at the top so it reads from the
 * beginning, or leaves the reader where they scrolled.
 */
export type ScrollMode =
  | { mode: 'following' }
  | { mode: 'reading' }
  | {
      mode: 'anchored';
      anchor: HTMLElement;
      /** Whether the answer's start still sits at the top. */
      aligned: boolean;
    };

export type ScrollModeEvent =
  /** A new question, or jumping to the latest answer. */
  | { type: 'follow' }
  /** An answer started streaming while the reader was at the end. */
  | { type: 'anchor'; anchor: HTMLElement }
  /** The reader scrolls by wheel, touch, or keyboard. */
  | { type: 'userScroll'; upward: boolean }
  /** The viewport scrolled, by the reader or by Docspot. */
  | {
      type: 'scrolled';
      atEnd: boolean;
      upward: boolean;
      downward: boolean;
      /** Whether the anchored answer's start is above the viewport. */
      pastAnchor: boolean;
    };

export const following: ScrollMode = { mode: 'following' };
const reading: ScrollMode = { mode: 'reading' };

/** Pure transitions. Returns the same state when nothing changes. */
export function scrollMode(
  state: ScrollMode,
  event: ScrollModeEvent
): ScrollMode {
  switch (event.type) {
    case 'follow':
      return state.mode === 'following' ? state : following;
    case 'anchor':
      return { mode: 'anchored', anchor: event.anchor, aligned: true };
    case 'userScroll':
      if (state.mode === 'anchored')
        return state.aligned ? { ...state, aligned: false } : state;
      return state.mode === 'following' && event.upward ? reading : state;
    case 'scrolled': {
      // Reaching the end follows again; past an anchored answer, only once
      // the reader scrolls down beyond its start.
      const resumes =
        event.atEnd &&
        (state.mode !== 'anchored' || (event.downward && event.pastAnchor));
      if (resumes) return state.mode === 'following' ? state : following;
      return state.mode === 'following' && event.upward ? reading : state;
    }
  }
}
