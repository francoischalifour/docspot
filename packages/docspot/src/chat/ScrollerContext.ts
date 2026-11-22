import { createContext } from 'react';

export type ScrollerApi = {
  /** Scrolls an answer's start to the top and keeps it there while it grows. */
  startReadingAt: (element: HTMLElement) => void;
};

export const ScrollerContext =
  /* @__PURE__ */ createContext<ScrollerApi | null>(null);
