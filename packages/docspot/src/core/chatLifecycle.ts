import type { ChatRequest } from '@/core/context';

/** Why chat is opening: the request to apply once the runtime has loaded. */
export type ChatIntent = {
  request?: ChatRequest;
  /** Moves focus to the composer once open. */
  focus: boolean;
  /** The URL chat link that asked, removed from the URL once applied. */
  linkKey?: string;
};

/**
 * The chat panel's lifecycle. The panel shows from `starting` on; it is
 * `open` once the runtime has loaded and the intent has been applied.
 */
export type ChatLifecycle =
  | { status: 'closed' }
  | { status: 'starting'; intent: ChatIntent }
  | { status: 'failed'; intent: ChatIntent }
  | { status: 'open' };

export type ChatLifecycleEvent =
  /** Something asks chat to open, with what to do once it has. */
  | { type: 'open'; intent: ChatIntent }
  /** The runtime loaded for this intent. */
  | { type: 'loaded'; intent: ChatIntent }
  /** The runtime failed to load for this intent, after retrying. */
  | { type: 'loadFailed'; intent: ChatIntent }
  | { type: 'close' }
  /** The chat transport changed: everything starts over, closed. */
  | { type: 'reset' };

export const closedChat: ChatLifecycle = { status: 'closed' };

/**
 * Pure transitions. Results for an intent that a newer one replaced, or
 * that closing dropped, are ignored, so a slow load never applies late.
 * Returns the same state when nothing changes.
 */
export function chatLifecycle(
  state: ChatLifecycle,
  event: ChatLifecycleEvent
): ChatLifecycle {
  switch (event.type) {
    case 'open':
      return { status: 'starting', intent: event.intent };
    case 'loaded':
      return isPending(state, event.intent) ? { status: 'open' } : state;
    case 'loadFailed':
      return isPending(state, event.intent)
        ? { status: 'failed', intent: event.intent }
        : state;
    case 'close':
    case 'reset':
      return state.status === 'closed' ? state : closedChat;
  }
}

function isPending(state: ChatLifecycle, intent: ChatIntent) {
  return (
    (state.status === 'starting' || state.status === 'failed') &&
    state.intent === intent
  );
}

/** The intent still waiting for the runtime, if any. */
export function pendingIntent(state: ChatLifecycle): ChatIntent | undefined {
  return state.status === 'starting' || state.status === 'failed'
    ? state.intent
    : undefined;
}
