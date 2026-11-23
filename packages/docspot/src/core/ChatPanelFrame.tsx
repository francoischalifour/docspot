import {
  type CSSProperties,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from 'react';
import { flushSync } from 'react-dom';

import { useDocspotInternal } from '@/core/context';
import type { ChatPanelProps } from '@/core/ChatPanel';
import {
  isChatBesidePage,
  isCommandKey,
  prefersReducedMotion,
  useVisualViewport,
} from '@/core/platform';
import { CloseIcon } from '@/ui/icons';
import { SlotIcon } from '@/ui/SlotIcon';
import { IconButton } from '@/ui/IconButton';
import { Shimmer } from '@/ui/Shimmer';
import { cx } from '@/ui/cx';

import {
  PANEL_SLIDE_EASING,
  getPanelContentOpacity,
  getPanelOffsetStyle,
} from '@/core/chatPanelSize';
import {
  gestureDirection,
  gestureResize,
  idleGesture,
  panelGesture,
} from '@/core/panelGesture';
import { ResizeHandle } from '@/core/ResizeHandle';

/** Slides back into place after a drag past the minimum width. */
const SETTLE_DURATION_MS = 200;
/** Slides out of view after a drag that hides the panel. */
const HIDE_DURATION_MS = 150;

/** The chat panel, loaded with chat: its frame, resizing, and startup state. */
export function ChatPanelFrame({ dock = 'fixed', className }: ChatPanelProps) {
  const { config, search, chat } = useDocspotInternal('Docspot.ChatPanel');
  const { messages, canSearch } = config;
  const { isOpen, runtime, session } = chat;
  // A link chat waits to leave for; closing or opening ends the wait.
  const leavingRef = useRef<object | null>(null);
  useEffect(() => {
    leavingRef.current = null;
  }, [isOpen]);
  const [element, setElement] = useState<HTMLElement | null>(null);
  useVisualViewport(isOpen ? element : null);
  const [gesture, dispatchGesture] = useReducer(panelGesture, idleGesture);
  const resize = gestureResize(gesture);
  // Offsets are signed: positive moves the panel right.
  const toward = gestureDirection(gesture);
  const width = resize?.width ?? chat.width;
  const overshoot = resize?.overshoot ?? 0;

  /** Animates the panel to an offset, then applies the resulting state. */
  function slideTo(offset: number, duration: number, onSettled: () => void) {
    const animation =
      element && !prefersReducedMotion()
        ? element.animate([getPanelOffsetStyle(offset)], {
            duration,
            easing: PANEL_SLIDE_EASING,
            fill: 'forwards',
          })
        : undefined;
    let cancelled = false;
    void (animation?.finished ?? Promise.resolve()).then(
      () => {
        if (cancelled) return;
        flushSync(onSettled);
        animation?.cancel();
      },
      () => {}
    );
    return () => {
      cancelled = true;
      animation?.cancel();
    };
  }

  // A gesture that ends animates first, then saves the width or closes.
  const finishGesture = useEffectEvent(() => {
    if (gesture.status === 'settling') {
      const { width: settledWidth } = gesture;
      const save = () => {
        chat.setWidth(settledWidth);
        dispatchGesture({ type: 'settled' });
      };
      // Only a panel dragged past its minimum width has somewhere to slide.
      if (gesture.resize?.overshoot)
        return slideTo(0, SETTLE_DURATION_MS, save);
      else save();
    } else if (gesture.status === 'hiding') {
      return slideTo(
        toward * (element?.offsetWidth ?? 0),
        HIDE_DURATION_MS,
        () => {
          dispatchGesture({ type: 'settled' });
          chat.close();
        }
      );
    }
  });
  useEffect(() => finishGesture(), [gesture.status]);

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

  const Conversation = runtime?.Conversation;

  return (
    <aside
      id={config.chatPanelId}
      ref={setElement}
      data-docspot-chat=""
      data-dock={dock}
      data-open={isOpen || undefined}
      data-resizing={resize !== null || undefined}
      data-sliding-out={gesture.status === 'hiding' || undefined}
      aria-label={messages.chat.title}
      className={cx('docspot-chat', className)}
      // Past its minimum width, the panel follows the pointer out.
      style={
        overshoot
          ? ({
              ...getPanelOffsetStyle(toward * overshoot),
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
      <ResizeHandle width={width} onGesture={dispatchGesture} />
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
              <SlotIcon name="close" icon={CloseIcon} size={16} />
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
      {session && Conversation && (
        <Conversation
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
            chat.open({ action: 'resume', conversation })
          }
          onNewConversation={() => chat.open({ action: 'reset' })}
          onClose={chat.close}
          onNavigate={(url, event) => {
            event.preventDefault();
            const navigation = config.navigate(url, { event });
            // A full-screen panel would hide the page the link opens. It
            // stays until that page shows, without a flash of this one.
            const leaving = isChatBesidePage() ? null : {};
            leavingRef.current = leaving;
            const closeAfterNavigation = () => {
              if (leaving && leavingRef.current === leaving) chat.close();
            };
            if (!navigation) return closeAfterNavigation();
            void navigation.then(closeAfterNavigation, () => {
              if (leavingRef.current === leaving) leavingRef.current = null;
            });
          }}
          toInternalUrl={config.toInternalUrl}
          messages={messages}
        />
      )}
    </aside>
  );
}
