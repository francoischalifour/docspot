import {
  Component,
  type ReactNode,
  Suspense,
  useDeferredValue,
  useEffectEvent,
  useLayoutEffect,
} from 'react';

import { type ChatRequest, useDocspotInternal } from '@/core/Root';
import { hasModifierKey, isExternalUrl } from '@/core/platform';
import { stripHash } from '@/core/url';
import type { DocspotLinkItem } from '@/types';
import { isLinkItem } from '@/search/items';
import { ExternalIcon, PageIcon } from '@/ui/icons';
import { cx } from '@/ui/primitives';
import { Welcome, getPrompts } from '@/ui/Suggestions';
import { useScrollEdges } from '@/ui/useScrollEdges';
import type {
  AskItem,
  HandoffItem,
  ListItem,
  SearchItem,
} from '@/search/model';

export function PreviewPanel({
  activeItem,
  query,
  isLoading,
  onClose,
  onLeave,
  onNotify,
  onStartChat,
  onHandoff,
  onRun,
}: {
  activeItem: SearchItem | undefined;
  query: string;
  isLoading: boolean;
  onClose: () => void;
  /** Closes search to follow a link, keeping the query for Back. */
  onLeave: () => void;
  onNotify: (message: string) => void;
  onStartChat: (request?: ChatRequest) => void;
  /** Records a handoff opened from its preview. */
  onHandoff: (item: HandoffItem) => void;
  /** Runs an action from its preview. */
  onRun: (item: ListItem) => void;
}) {
  const deferredItem = useDeferredValue(activeItem);
  const isStale = Boolean(
    deferredItem &&
    (deferredItem.query !== query || deferredItem !== activeItem)
  );
  return (
    <div
      className="docspot-search-preview"
      aria-busy={isLoading || isStale}
      inert={isStale}
    >
      {/* Like stalled results, dims only after 300ms so typing doesn't flicker. */}
      <div className={cx('docspot-preview-frame', isStale && 'docspot-stale')}>
        <Suspense fallback={<PreviewLoading />}>
          {deferredItem?.kind === 'item' && isLinkItem(deferredItem.item) ? (
            <PagePreview
              item={deferredItem.item}
              query={deferredItem.query}
              onClose={onClose}
              onLeave={onLeave}
              onNotify={onNotify}
            />
          ) : deferredItem?.kind === 'handoff' ? (
            <HandoffPreview item={deferredItem} onOpen={onHandoff} />
          ) : deferredItem?.kind === 'item' ? (
            <ActionPreview item={deferredItem} onRun={onRun} />
          ) : deferredItem ? (
            <AskPreview item={deferredItem} onStartChat={onStartChat} />
          ) : (
            <PreviewLoading />
          )}
        </Suspense>
      </div>
    </div>
  );
}

/** Falls back to the result summary when a preview fails to render. */
class PreviewErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { hasError: boolean }
> {
  override state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  override render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

function PagePreview({
  item,
  query,
  onClose,
  onLeave,
  onNotify,
}: {
  item: DocspotLinkItem;
  query: string;
  onClose: () => void;
  onLeave: () => void;
  onNotify: (message: string) => void;
}) {
  const { config } = useDocspotInternal('Docspot.SearchDialog');
  const messages = config.messages.search;
  const Preview = config.slots.preview;
  const PageActions = config.slots.pageActions;
  const { ref, bind, canScrollDown } = useScrollEdges<HTMLDivElement>();

  // Opens at the matched section, or at the top.
  const scrollToResult = useEffectEvent(() => {
    const container = ref.current;
    if (!container) return;
    let anchor = '';
    try {
      anchor = decodeURIComponent(
        new URL(item.action, window.location.href).hash.slice(1)
      );
    } catch {
      // An invalid anchor opens the preview at the top.
    }
    const escaped = anchor && CSS.escape(anchor);
    const target = escaped
      ? container.querySelector<HTMLElement>(
          `[data-docspot-anchor="${escaped}"], [id="${escaped}"]`
        )
      : null;
    container.scrollTop = target
      ? target.getBoundingClientRect().top -
        container.getBoundingClientRect().top +
        container.scrollTop -
        16
      : 0;
  });
  useLayoutEffect(() => {
    scrollToResult();
  }, [item.action]);

  function navigate(url: string) {
    onLeave();
    config.navigate(url, {});
  }

  // Shown when the preview fails to render.
  const fallback = (
    <div>
      <h2 className="docspot-preview-title">{item.pageTitle ?? item.title}</h2>
      {item.excerpt && <p className="docspot-preview-text">{item.excerpt}</p>}
    </div>
  );

  return (
    <section aria-label={messages.preview} className="docspot-preview">
      <div
        ref={bind}
        className="docspot-preview-scroll"
        // Internal links in the preview open their page and close search.
        onClick={event => {
          const link = (event.target as Element).closest('a');
          if (
            event.defaultPrevented ||
            !link ||
            hasModifierKey(event) ||
            link.target === '_blank'
          )
            return;
          const href = link.getAttribute('href');
          if (!href) return;
          const target = href.startsWith('#')
            ? `${stripHash(item.action)}${href}`
            : href;
          const url = new URL(target, window.location.href);
          if (url.origin !== window.location.origin) return;
          event.preventDefault();
          navigate(target);
        }}
      >
        {(item.breadcrumb?.length || item.group) && (
          <p className="docspot-preview-label">
            {item.breadcrumb?.length ? item.breadcrumb.join(' › ') : item.group}
          </p>
        )}
        {isExternalUrl(item.action) ? (
          // The preview slot renders this site's pages; another site's link says what it is.
          <>
            <h2 className="docspot-preview-title">{item.title}</h2>
            {(item.description ?? item.excerpt) && (
              <p className="docspot-preview-text">
                {item.description ?? item.excerpt}
              </p>
            )}
          </>
        ) : (
          Preview && (
            <PreviewErrorBoundary key={item.action} fallback={fallback}>
              <Preview
                item={item}
                query={query}
                navigate={navigate}
                notify={onNotify}
              />
            </PreviewErrorBoundary>
          )
        )}
      </div>
      <div
        className={cx(
          'docspot-preview-footer',
          canScrollDown && 'docspot-fade-above'
        )}
      >
        {isExternalUrl(item.action) ? (
          <a
            href={item.action}
            target="_blank"
            rel="noopener noreferrer"
            className="docspot-button docspot-button-ghost"
          >
            {messages.openLink}
            <ExternalIcon size={12} />
          </a>
        ) : (
          <a
            href={item.action}
            className="docspot-button docspot-button-ghost"
            onClick={event => {
              if (event.button !== 0 || hasModifierKey(event)) return;
              event.preventDefault();
              onLeave();
              config.navigate(item.action, { event });
            }}
          >
            {messages.openPage}
          </a>
        )}
        {PageActions && (
          <PageActions
            item={item}
            query={query}
            close={onClose}
            notify={onNotify}
          />
        )}
      </div>
    </section>
  );
}

/** Says where a handoff goes and what it sends. */
function HandoffPreview({
  item,
  onOpen,
}: {
  item: HandoffItem;
  onOpen: (item: HandoffItem) => void;
}) {
  const { config } = useDocspotInternal('Docspot.SearchDialog');
  const messages = config.messages.search;
  const { handoff } = item;
  return (
    <section aria-label={messages.preview} className="docspot-preview">
      <div className="docspot-preview-scroll">
        <p className="docspot-preview-label">{messages.handoffs}</p>
        <h2 className="docspot-preview-title">{handoff.title}</h2>
        <p className="docspot-preview-text">
          {messages.quotedQuery(item.query)}
        </p>
        <p className="docspot-preview-hint">
          {handoff.description ?? messages.handoffDescription}
        </p>
      </div>
      <div className="docspot-preview-footer">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="docspot-button docspot-button-ghost"
          onClick={() => onOpen(item)}
        >
          {messages.openLink}
          <ExternalIcon size={12} />
        </a>
      </div>
    </section>
  );
}

/** Names an action and says what it does, with a button that runs it. */
function ActionPreview({
  item,
  onRun,
}: {
  item: ListItem;
  onRun: (item: ListItem) => void;
}) {
  const { config } = useDocspotInternal('Docspot.SearchDialog');
  const messages = config.messages.search;
  const { item: command } = item;
  return (
    <section aria-label={messages.preview} className="docspot-preview">
      <div className="docspot-preview-scroll">
        <p className="docspot-preview-label">{item.sourceLabel}</p>
        <h2 className="docspot-preview-title">{command.title}</h2>
        {command.description && (
          <p className="docspot-preview-text">{command.description}</p>
        )}
      </div>
      <div className="docspot-preview-footer">
        <button
          type="button"
          className="docspot-button docspot-button-ghost"
          onClick={() => onRun(item)}
        >
          {messages.run}
        </button>
      </div>
    </section>
  );
}

/**
 * Shows what asking sends: the question and the page attached to it. The
 * search input stays the only place to edit the question.
 */
function AskPreview({
  item,
  onStartChat,
}: {
  item: AskItem;
  onStartChat: (request?: ChatRequest) => void;
}) {
  const { config } = useDocspotInternal('Docspot.SearchDialog');
  const messages = config.messages;
  const { query, conversation } = item;
  // A suggested question previews like a typed one.
  const asked = query || item.prompt;
  const page = asked ? config.currentPage : undefined;
  const text = asked ? messages.search.quotedQuery(asked) : conversation?.title;
  return (
    <section
      aria-label={messages.search.askPreview}
      className="docspot-ask-preview"
    >
      <div className="docspot-ask-preview-inner">
        {text ? (
          <div>
            <p className="docspot-ask-preview-text">{text}</p>
            {page && (
              <span className="docspot-context-chip">
                <span className="docspot-context-chip-label">
                  <PageIcon size={12} className="docspot-muted" />
                  <span className="docspot-truncate">
                    <span className="docspot-sr-only">
                      {messages.chat.pageContext}
                    </span>
                    {page.title ?? page.url}
                  </span>
                </span>
              </span>
            )}
            <p className="docspot-preview-hint">
              {asked
                ? messages.search.enterToAsk
                : messages.search.continueChat}
            </p>
          </div>
        ) : (
          <Welcome
            title={messages.chat.welcome}
            questions={getPrompts(config.currentPage, config.prompts)}
            onChoose={question =>
              onStartChat({
                action: 'submit',
                text: question,
                source: 'prompt',
              })
            }
          />
        )}
      </div>
    </section>
  );
}

function PreviewLoading() {
  const { config } = useDocspotInternal('Docspot.SearchDialog');
  return (
    <div
      role="status"
      aria-label={config.messages.search.loadingPreview}
      className="docspot-preview-skeleton"
    >
      <div aria-hidden="true" className="docspot-skeleton-body">
        <div className="docspot-skeleton-line" style={{ width: '7rem' }} />
        <div className="docspot-skeleton-heading" />
        {[3, 2].map((lines, index) => (
          <div key={index} className="docspot-skeleton-paragraph">
            {Array.from({ length: lines }, (_, line) => (
              <div key={line} className="docspot-skeleton-line" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
