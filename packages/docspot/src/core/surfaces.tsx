import { type ComponentProps, Suspense, lazy } from 'react';

import { SearchIcon } from '@/ui/icons';
import { Kbd, composeHandlers, cx, mergeRefs } from '@/ui/primitives';
import {
  chatFrameLoader,
  searchDialogLoader,
  useDocspotInternal,
} from '@/core/context';

const LazySearchDialog = /* @__PURE__ */ lazy(() =>
  searchDialogLoader.load().then(module => ({ default: module.SearchDialog }))
);

const LazyChatPanelFrame = /* @__PURE__ */ lazy(() =>
  chatFrameLoader.load().then(module => ({ default: module.ChatPanelFrame }))
);

/**
 * Button props, including `ref`. Handlers run before Docspot's; calling
 * `preventDefault` in `onClick` keeps the surface closed.
 */
export type SearchTriggerProps = Omit<ComponentProps<'button'>, 'type'>;

/** Opens search. Renders nothing without `search`. */
export function SearchTrigger({
  ref,
  className,
  children,
  onClick,
  onFocus,
  onPointerEnter,
  ...props
}: SearchTriggerProps) {
  const { config, search } = useDocspotInternal('Docspot.SearchTrigger');
  if (!config.canSearch) return null;
  const label = config.canChat
    ? config.messages.trigger.searchAndAsk
    : config.messages.trigger.search;
  return (
    <button
      type="button"
      aria-keyshortcuts="Meta+K Control+K /"
      aria-haspopup="dialog"
      {...props}
      // Focus returns to a visible trigger when search closes.
      ref={mergeRefs(ref, search.registerTrigger)}
      className={cx('docspot-trigger', className)}
      onPointerEnter={composeHandlers(search.preload, onPointerEnter)}
      onFocus={composeHandlers(search.preload, onFocus)}
      onClick={event => {
        onClick?.(event);
        if (!event.defaultPrevented) search.open(event.currentTarget);
      }}
    >
      {children ?? (
        <>
          <span className="docspot-trigger-label">
            <SearchIcon className="docspot-muted" />
            <span className="docspot-trigger-text">{label}</span>
          </span>
          <Kbd
            aria-hidden="true"
            keys={['mod', 'k']}
            className="docspot-trigger-kbd"
          />
        </>
      )}
    </button>
  );
}

/** Button props, as for `SearchTriggerProps`. */
export type ChatTriggerProps = Omit<ComponentProps<'button'>, 'type'>;

/** Opens or hides chat. Renders nothing without `chat`. */
export function ChatTrigger({
  className,
  children,
  onClick,
  onFocus,
  onPointerEnter,
  ...props
}: ChatTriggerProps) {
  const { config, chat } = useDocspotInternal('Docspot.ChatTrigger');
  if (!config.canChat) return null;
  return (
    <button
      type="button"
      aria-keyshortcuts="Meta+J Control+J"
      {...props}
      aria-expanded={chat.isOpen}
      aria-controls={config.chatPanelId}
      className={cx('docspot-trigger docspot-chat-trigger', className)}
      onPointerEnter={composeHandlers(chat.preload, onPointerEnter)}
      onFocus={composeHandlers(chat.preload, onFocus)}
      onClick={event => {
        onClick?.(event);
        if (!event.defaultPrevented) chat.toggle();
      }}
    >
      {children ?? (
        <>
          <span className="docspot-trigger-text">
            {config.messages.trigger.chat}
          </span>
          <Kbd
            aria-hidden="true"
            keys={['mod', 'j']}
            className="docspot-trigger-kbd"
          />
        </>
      )}
    </button>
  );
}

/** Button props, as for `SearchTriggerProps`. */
export type TriggerProps = SearchTriggerProps & ChatTriggerProps;

/** Opens search when configured, otherwise chat. */
export function Trigger(props: TriggerProps) {
  const { config } = useDocspotInternal('Docspot.Trigger');
  return config.canSearch ? (
    <SearchTrigger {...props} />
  ) : (
    <ChatTrigger {...props} />
  );
}

/** The search dialog, rendered while search is open. */
export function SearchDialog() {
  const { config, search } = useDocspotInternal('Docspot.SearchDialog');
  if (!config.canSearch || !search.isOpen) return null;
  // Once preloaded, the dialog renders in the same frame; lazy would wait one.
  const Dialog = searchDialogLoader.get()?.SearchDialog ?? LazySearchDialog;
  return (
    <Suspense>
      <Dialog />
    </Suspense>
  );
}

type ChatLauncherProps = { hidden: boolean };

/** Sits where the panel opens, so the chat's place on screen is clear. */
function ChatLauncher({ hidden }: ChatLauncherProps) {
  const { config, chat } = useDocspotInternal('Docspot.ChatPanel');
  return (
    <span
      className="docspot-tooltip-anchor docspot-launcher-anchor"
      data-side="left"
      hidden={hidden}
    >
      <button
        ref={chat.registerLauncher}
        type="button"
        aria-expanded={false}
        aria-controls={config.chatPanelId}
        aria-keyshortcuts="Meta+J Control+J"
        onPointerEnter={chat.preload}
        onFocus={chat.preload}
        onClick={() => chat.open()}
        // Stays mounted while hidden, so focus can return to it.
        hidden={hidden}
        className="docspot-launcher"
      >
        {config.messages.chat.launcher}
        <Kbd
          aria-hidden="true"
          keys={['mod', 'j']}
          className="docspot-trigger-kbd"
        />
      </button>
    </span>
  );
}

export type ChatPanelProps = {
  /**
   * `fixed` (default) pins the docked panel to the right edge of the window.
   * `inline` docks it as a flex item where it is rendered, beside the page.
   */
  dock?: 'fixed' | 'inline';
  /** Shows a floating button that opens chat while the panel is hidden. */
  launcher?: boolean;
  className?: string;
};

/** The chat panel. Renders nothing without `chat`. */
export function ChatPanel({ launcher = true, ...props }: ChatPanelProps) {
  const { config, chat } = useDocspotInternal('Docspot.ChatPanel');
  if (!config.canChat) return null;
  // The frame loads with chat, so pages without chat never load it. Once
  // loaded, it renders in the same frame; lazy would wait one.
  const Frame = chatFrameLoader.get()?.ChatPanelFrame ?? LazyChatPanelFrame;
  return (
    <>
      {launcher && <ChatLauncher hidden={chat.isOpen} />}
      <Suspense>
        <Frame {...props} />
      </Suspense>
    </>
  );
}
