import { type CSSProperties, useLayoutEffect, useState } from 'react';
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
import { IconButton } from '@/ui/IconButton';
import { Shimmer } from '@/ui/Shimmer';
import { cx } from '@/ui/cx';

// Loaded with chat: the panel and its startup state.
import {
  PANEL_SLIDE_EASING,
  type PanelResize,
  getPanelContentOpacity,
  getPanelOffsetStyle,
} from '@/core/chatPanelSize';
import { ResizeHandle } from '@/core/ResizeHandle';

type ChatPanelFrameProps = Omit<ChatPanelProps, 'launcher'>;

export function ChatPanelFrame({
  dock = 'fixed',
  className,
}: ChatPanelFrameProps) {
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

  const Conversation = runtime?.Conversation;

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
