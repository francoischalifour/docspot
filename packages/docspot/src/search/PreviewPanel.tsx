import {
  Component,
  type ReactNode,
  Suspense,
  useDeferredValue,
  useEffectEvent,
  useLayoutEffect,
} from 'react';

import { type ChatRequest, useDocspotInternal } from '../core/Root';
import { hasModifierKey, isExternalUrl } from '../core/platform';
import type { DocspotSearchResult } from '../types';
import { ExternalIcon, SendIcon } from '../ui/icons';
import { cx } from '../ui/primitives';
import { Welcome, getPrompts } from '../ui/Suggestions';
import { useScrollEdges } from '../ui/useScrollEdges';
import type { AskItem, HandoffItem, SearchItem } from './model';

export function PreviewPanel({
  activeItem,
  query,
  isLoading,
  onClose,
  onLeave,
  onNotify,
  onStartChat,
  onHandoff,
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
          {deferredItem?.kind === 'page' ? (
            <PagePreview
              result={deferredItem.result}
              query={deferredItem.query}
              onClose={onClose}
              onLeave={onLeave}
              onNotify={onNotify}
            />
          ) : deferredItem?.kind === 'handoff' ? (
            <HandoffPreview item={deferredItem} onOpen={onHandoff} />
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
  result,
  query,
  onClose,
  onLeave,
  onNotify,
}: {
  result: DocspotSearchResult;
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
        new URL(result.url, window.location.href).hash.slice(1)
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
  }, [result.url]);

  function navigate(url: string) {
    onLeave();
    config.navigate(url, {});
  }

  const fallback = (
    <div>
      <h2 className="docspot-preview-title">
        {result.pageTitle ?? result.title}
      </h2>
      {result.excerpt && (
        <p className="docspot-preview-text">{result.excerpt}</p>
      )}
      <p className="docspot-preview-hint">{messages.previewFallback}</p>
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
            ? `${result.url.split('#')[0]}${href}`
            : href;
          const url = new URL(target, window.location.href);
          if (url.origin !== window.location.origin) return;
          event.preventDefault();
          navigate(target);
        }}
      >
        {(result.breadcrumb?.length || result.group) && (
          <p className="docspot-preview-label">
            {result.breadcrumb?.length
              ? result.breadcrumb.join(' › ')
              : result.group}
          </p>
        )}
        {Preview ? (
          <PreviewErrorBoundary key={result.url} fallback={fallback}>
            <Preview
              result={result}
              query={query}
              navigate={navigate}
              notify={onNotify}
            />
          </PreviewErrorBoundary>
        ) : (
          fallback
        )}
      </div>
      <div
        className={cx(
          'docspot-preview-footer',
          canScrollDown && 'docspot-fade-above'
        )}
      >
        {isExternalUrl(result.url) ? (
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="docspot-button docspot-button-ghost"
          >
            {messages.openLink}
            <ExternalIcon size={12} />
          </a>
        ) : (
          <a
            href={result.url}
            className="docspot-button docspot-button-ghost"
            onClick={event => {
              if (event.button !== 0 || hasModifierKey(event)) return;
              event.preventDefault();
              onLeave();
              config.navigate(result.url, { event });
            }}
          >
            {messages.openPage}
          </a>
        )}
        {PageActions && (
          <PageActions
            result={result}
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

/** Shows what chat will receive; the conversation happens in the panel. */
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
  function start() {
    if (query) onStartChat({ action: 'submit', text: query, source: 'search' });
    else if (conversation) onStartChat({ action: 'resume', conversation });
    else onStartChat();
  }
  const text = query || conversation?.title;
  const action = query
    ? messages.search.askDocs
    : conversation
      ? messages.search.continueChat
      : messages.search.openChat;
  return (
    <section
      aria-label={messages.search.askPreview}
      className="docspot-ask-preview"
    >
      <div className="docspot-ask-preview-inner">
        {!text && (
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
        {/* The question sits in a composer-like card whose send button sends it. */}
        <button
          type="button"
          onClick={start}
          aria-label={text ? `${action}: ${text}` : action}
          aria-keyshortcuts="Enter"
          className="docspot-ask-card"
        >
          <span
            className={cx('docspot-ask-card-text', !text && 'docspot-subtle')}
          >
            {text ?? messages.chat.placeholder}
          </span>
          <span aria-hidden="true" className="docspot-send-icon">
            <SendIcon size={14} />
          </span>
        </button>
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
