import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { flushSync } from 'react-dom';

import { useDocspotInternal } from '@/core/Root';
import type { ChatPanelProps } from '@/core/surfaces';
import {
  isChatBesidePage,
  isCommandKey,
  prefersReducedMotion,
  useVisualViewport,
} from '@/core/platform';
import { CloseIcon } from '@/ui/icons';
import { IconButton, Shimmer, cx } from '@/ui/primitives';

// Loaded with chat: the panel, its resizing, and its startup state.

/** Matches the 25rem width the stylesheet docks the panel at. */
const PANEL_DEFAULT_WIDTH = 400;
const PANEL_MIN_WIDTH = 320;
const PANEL_MAX_WIDTH = 640;
/** Releasing a drag this far past the minimum width hides the panel. */
const PANEL_HIDE_DISTANCE = 80;
/** A flick hides the panel from a shorter distance. */
const PANEL_FLICK_HIDE_DISTANCE = 24;
/** In pixels per millisecond. */
const PANEL_FLICK_VELOCITY = 0.5;
const PANEL_SLIDE_EASING = 'cubic-bezier(0.23, 1, 0.32, 1)';

type PanelResize = {
  width: number;
  /** How far a drag goes past the minimum width. */
  overshoot: number;
};

function clampPanelWidth(width: number) {
  return Math.round(
    Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, width))
  );
}

/** Moves the panel right, filling the space it leaves with the page color. */
function getPanelOffsetStyle(offset: number) {
  return {
    transform: `translateX(${offset}px)`,
    boxShadow: `${-offset}px 0 var(--docspot-background)`,
  };
}

/** Fades the panel content until releasing would hide it. */
function getPanelContentOpacity(offset: number) {
  return 1 - Math.min(offset / PANEL_HIDE_DISTANCE, 1) * 0.6;
}

export function ChatPanelFrame({
  dock = 'fixed',
  className,
}: Omit<ChatPanelProps, 'launcher'>) {
  const { config, search, chat } = useDocspotInternal('Docspot.ChatPanel');
  const { messages, canSearch } = config;
  const { isOpen, runtime, session } = chat;
  const [element, setElement] = useState<HTMLElement | null>(null);
  useVisualViewport(isOpen ? element : null);
  const [resize, setResize] = useState<PanelResize | null>(null);
  const width = resize?.width ?? chat.width;
  const overshoot = resize?.overshoot ?? 0;
  const [isSlidingOut, setIsSlidingOut] = useState(false);

  /** Animates the panel to an offset, then applies the resulting state. */
  async function slideTo(
    offset: number,
    duration: number,
    onSettled: () => void
  ) {
    const animation =
      element && !prefersReducedMotion()
        ? element.animate([getPanelOffsetStyle(offset)], {
            duration,
            easing: PANEL_SLIDE_EASING,
            fill: 'forwards',
          })
        : undefined;
    await animation?.finished.catch(() => {});
    flushSync(onSettled);
    animation?.cancel();
  }

  // Pages beside the docked panel read these to make room for it.
  useLayoutEffect(() => {
    if (!config.owner) return;
    const owner =
      'documentElement' in config.owner
        ? config.owner.documentElement
        : config.owner;
    if (width) owner.style.setProperty('--docspot-chat-width', `${width}px`);
    else owner.style.removeProperty('--docspot-chat-width');
    if (isOpen) owner.setAttribute('data-docspot-chat-open', dock);
    else owner.removeAttribute('data-docspot-chat-open');
    return () => {
      owner.style.removeProperty('--docspot-chat-width');
      owner.removeAttribute('data-docspot-chat-open');
    };
  }, [config.owner, width, isOpen, dock]);

  const Panel = runtime?.Panel;

  return (
    <aside
      id={config.chatPanelId}
      ref={setElement}
      data-docspot-chat=""
      data-dock={dock}
      data-open={isOpen || undefined}
      data-resizing={resize !== null || undefined}
      data-sliding-out={isSlidingOut || undefined}
      aria-label={messages.chat.title}
      className={cx('docspot-chat', className)}
      // Past its minimum width, the panel follows the pointer out.
      style={
        overshoot
          ? ({
              ...getPanelOffsetStyle(overshoot),
              '--docspot-chat-content-opacity':
                getPanelContentOpacity(overshoot),
            } as CSSProperties)
          : undefined
      }
      // Global shortcuts pause while typing, so the panel handles its own.
      onKeyDown={event => {
        // Menus may render elsewhere but still bubble through React.
        if (
          event.defaultPrevented ||
          event.nativeEvent.isComposing ||
          !event.currentTarget.contains(event.target as Node)
        )
          return;
        if (event.key === 'Escape') chat.close();
        else if (canSearch && isCommandKey(event, 'k')) {
          if (!event.repeat) search.open();
        } else if (isCommandKey(event, 'j')) {
          if (!event.repeat) chat.close();
        } else return;
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <ResizeHandle
        width={width}
        onResize={setResize}
        onResizeEnd={nextWidth => {
          void slideTo(0, 200, () => {
            setResize(null);
            chat.setWidth(nextWidth);
          });
        }}
        onHide={() => {
          setIsSlidingOut(true);
          void slideTo(element?.offsetWidth ?? 0, 150, () => {
            setIsSlidingOut(false);
            setResize(null);
            chat.close();
          });
        }}
      />
      {isOpen && !session && (
        <div className="docspot-chat-body">
          <div className="docspot-chat-header">
            <span className="docspot-startup-title">{messages.chat.title}</span>
            <IconButton
              side="left"
              autoFocus={chat.focusStartup}
              label={messages.chat.hide}
              onClick={chat.close}
            >
              <CloseIcon size={16} />
            </IconButton>
          </div>
          <div className="docspot-chat-startup">
            <span role="status">
              {chat.retryStartup ? (
                messages.chat.startupFailed
              ) : (
                <Shimmer>{messages.chat.opening}</Shimmer>
              )}
            </span>
            {chat.retryStartup && (
              <button
                type="button"
                className="docspot-button"
                onClick={chat.retryStartup}
              >
                {messages.chat.retry}
              </button>
            )}
          </div>
        </div>
      )}
      {session && Panel && (
        <Panel
          key={session.id}
          session={session}
          composerRef={chat.composerRef}
          draft={chat.draft}
          onDraftChange={chat.setDraft}
          contextPage={chat.contextPage}
          onRemoveContext={chat.removeContext}
          prompts={config.prompts}
          conversations={{
            list: config.stores.conversations.get,
            subscribe: config.stores.conversations.subscribe,
            remove(id) {
              config.stores.conversations.set(list =>
                list.filter(item => item.id !== id)
              );
              config.emit({
                type: 'conversation.delete',
                conversationId: id,
              });
            },
            clear() {
              config.stores.conversations.set([]);
              config.emit({ type: 'conversation.clear' });
            },
          }}
          onSelectConversation={conversation =>
            chat.ask({ action: 'resume', conversation })
          }
          onNewConversation={() => chat.ask({ action: 'reset' })}
          onClose={chat.close}
          onNavigate={(url, event) => {
            event.preventDefault();
            // A full-screen panel would hide the page the link opens.
            if (!isChatBesidePage()) chat.close();
            config.navigate(url, { event });
          }}
          toInternalUrl={config.toInternalUrl}
          messages={messages}
        />
      )}
    </aside>
  );
}

type PanelDrag = {
  pointerId: number;
  startX: number;
  startWidth: number;
  lastX: number;
  lastTime: number;
  /** In pixels per millisecond, positive toward hiding the panel. */
  velocity: number;
};

/**
 * Drags or arrow keys resize the docked panel; double-click resets it. Past
 * the minimum width the panel follows the pointer, and releasing far enough,
 * or flicking, hides it.
 */
function ResizeHandle({
  width,
  onResize,
  onResizeEnd,
  onHide,
}: {
  width: number | undefined;
  onResize: (resize: PanelResize) => void;
  onResizeEnd: (width: number | undefined) => void;
  onHide: () => void;
}) {
  const { config } = useDocspotInternal('Docspot.ChatPanel');
  const messages = config.messages.chat;
  const dragRef = useRef<PanelDrag | null>(null);
  const currentWidth = width ?? PANEL_DEFAULT_WIDTH;

  function getResize(drag: PanelDrag, clientX: number): PanelResize {
    const draggedWidth = drag.startWidth + drag.startX - clientX;
    return {
      width: clampPanelWidth(draggedWidth),
      overshoot: Math.max(0, PANEL_MIN_WIDTH - draggedWidth),
    };
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (drag?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    const { width: nextWidth, overshoot } = getResize(drag, event.clientX);
    // A pause before release is not a flick.
    const isFlick =
      event.type === 'pointerup' &&
      event.timeStamp - drag.lastTime < 100 &&
      drag.velocity > PANEL_FLICK_VELOCITY;
    if (
      overshoot >= PANEL_HIDE_DISTANCE ||
      (isFlick && overshoot >= PANEL_FLICK_HIDE_DISTANCE)
    )
      onHide();
    else onResizeEnd(nextWidth);
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={messages.resize}
      aria-controls={config.chatPanelId}
      aria-valuemin={PANEL_MIN_WIDTH}
      aria-valuemax={PANEL_MAX_WIDTH}
      aria-valuenow={Math.round(currentWidth)}
      aria-valuetext={messages.pixels(Math.round(currentWidth))}
      title={messages.resizeHint}
      tabIndex={0}
      className="docspot-chat-resize"
      onPointerDown={event => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startWidth: currentWidth,
          lastX: event.clientX,
          lastTime: event.timeStamp,
          velocity: 0,
        };
      }}
      onPointerMove={event => {
        const drag = dragRef.current;
        if (drag?.pointerId !== event.pointerId) return;
        const elapsed = event.timeStamp - drag.lastTime;
        if (elapsed > 0) {
          drag.velocity = (event.clientX - drag.lastX) / elapsed;
          drag.lastX = event.clientX;
          drag.lastTime = event.timeStamp;
        }
        onResize(getResize(drag, event.clientX));
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={() => onResizeEnd(undefined)}
      onKeyDown={event => {
        const step = event.shiftKey ? 32 : 16;
        if (event.key === 'ArrowLeft')
          onResizeEnd(clampPanelWidth(currentWidth + step));
        else if (event.key === 'ArrowRight') {
          if (currentWidth <= PANEL_MIN_WIDTH) onHide();
          else onResizeEnd(clampPanelWidth(currentWidth - step));
        } else if (event.key === 'Home') onResizeEnd(PANEL_MIN_WIDTH);
        else if (event.key === 'End') onResizeEnd(PANEL_MAX_WIDTH);
        else return;
        event.preventDefault();
      }}
    />
  );
}
