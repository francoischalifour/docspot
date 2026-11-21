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
import type { DocspotResult } from '@/types';
import { ExternalIcon, PageIcon, QuestionIcon, SendIcon } from '@/ui/icons';
import { cx } from '@/ui/primitives';
import { Welcome, getPrompts } from '@/ui/Suggestions';
import { useScrollEdges } from '@/ui/useScrollEdges';
import type { AskEntry, ItemEntry, SearchItem } from '@/search/model';

export function PreviewPanel({
  activeItem,
  query,
  isLoading,
  onClose,
  onLeave,
  onNotify,
  onStartChat,
  onSelect,
}: {
  activeItem: SearchItem | undefined;
  query: string;
  isLoading: boolean;
  onClose: () => void;
  /** Closes search to follow a link, keeping the query for Back. */
  onLeave: () => void;
  onNotify: (message: string) => void;
  onStartChat: (request?: ChatRequest) => void;
  /** Chooses an item from its preview: runs it, or records the link opened. */
  onSelect: (item: SearchItem) => void;
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
          {deferredItem?.kind === 'result' ? (
            <ResultPreview
              result={deferredItem.result}
              query={deferredItem.query}
              onClose={onClose}
              onLeave={onLeave}
              onNotify={onNotify}
              onSelect={() => onSelect(deferredItem)}
            />
          ) : deferredItem?.kind === 'item' ? (
            <ItemPreview
              entry={deferredItem}
              onLeave={onLeave}
              onSelect={onSelect}
            />
          ) : deferredItem ? (
            <AskPreview
              item={deferredItem}
              onStartChat={onStartChat}
              onSelect={() => onSelect(deferredItem)}
            />
          ) : isLoading ? (
            <PreviewLoading />
          ) : null}
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

function ResultPreview({
  result,
  query,
  onClose,
  onLeave,
  onNotify,
  onSelect,
}: {
  result: DocspotResult;
  query: string;
  onClose: () => void;
  onLeave: () => void;
  onNotify: (message: string) => void;
  onSelect: () => void;
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

  // Shown when the preview fails to render.
  const fallback = (
    <div>
      <h2 className="docspot-preview-title">
        {result.pageTitle ?? result.title}
      </h2>
      {result.excerpt && (
        <p className="docspot-preview-text">{result.excerpt}</p>
      )}
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
            ? `${stripHash(result.url)}${href}`
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
        {isExternalUrl(result.url) ? (
          // The preview slot renders this site's pages; another site's link says what it is.
          <>
            <h2 className="docspot-preview-title">{result.title}</h2>
            {result.excerpt && (
              <p className="docspot-preview-text">{result.excerpt}</p>
            )}
          </>
        ) : (
          Preview && (
            <PreviewErrorBoundary key={result.url} fallback={fallback}>
              <Preview
                result={result}
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
        <PreviewLink url={result.url} onSelect={onSelect} onLeave={onLeave} />
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

/** Records the selection and leaves modified clicks to the browser. */
function PreviewLink({
  url,
  onSelect,
  onLeave,
}: {
  url: string;
  onSelect: () => void;
  onLeave: () => void;
}) {
  const { config } = useDocspotInternal('Docspot.SearchDialog');
  const external = isExternalUrl(url);
  return (
    <a
      href={url}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className="docspot-button docspot-button-ghost"
      onClick={event => {
        onSelect();
        if (external || event.button !== 0 || hasModifierKey(event)) return;
        event.preventDefault();
        onLeave();
        config.navigate(url, { event });
      }}
    >
      {external
        ? config.messages.search.openLink
        : config.messages.search.openPage}
      {external && <ExternalIcon size={12} />}
    </a>
  );
}

/**
 * Names an item and says what it does, or shows its own preview, with a
 * button that runs it or opens its link.
 */
function ItemPreview({
  entry,
  onLeave,
  onSelect,
}: {
  entry: ItemEntry;
  onLeave: () => void;
  onSelect: (item: ItemEntry) => void;
}) {
  const { config } = useDocspotInternal('Docspot.SearchDialog');
  const messages = config.messages.search;
  const { item, query } = entry;
  const { action, preview: Preview } = item;
  const summary = (
    <>
      <h2 className="docspot-preview-title">{item.title}</h2>
      {item.description && (
        <p className="docspot-preview-text">{item.description}</p>
      )}
    </>
  );
  return (
    <section aria-label={messages.preview} className="docspot-preview">
      <div className="docspot-preview-scroll">
        <p className="docspot-preview-label">{entry.sourceLabel}</p>
        {Preview ? (
          <PreviewErrorBoundary key={item.id} fallback={summary}>
            <Preview item={item} query={query} />
          </PreviewErrorBoundary>
        ) : (
          summary
        )}
      </div>
      <div className="docspot-preview-footer">
        {typeof action === 'function' ? (
          <button
            type="button"
            className="docspot-button docspot-button-ghost"
            onClick={() => onSelect(entry)}
          >
            {messages.run}
          </button>
        ) : (
          <PreviewLink
            url={action}
            onSelect={() => onSelect(entry)}
            onLeave={onLeave}
          />
        )}
      </div>
    </section>
  );
}

function AskPreview({
  item,
  onStartChat,
  onSelect,
}: {
  item: AskEntry;
  onStartChat: (request?: ChatRequest) => void;
  onSelect: () => void;
}) {
  const { config } = useDocspotInternal('Docspot.SearchDialog');
  const { search, chat } = config.messages;
  const page = config.currentPage;
  return (
    <section aria-label={search.askPreview} className="docspot-ask-preview">
      <div className="docspot-ask-preview-inner">
        {item.query || item.prompt ? (
          <div className="docspot-ask-ready">
            <span className="docspot-ask-preview-icon">
              <QuestionIcon size={22} />
            </span>
            <div>
              <h3 className="docspot-ask-preview-title">{chat.welcome}</h3>
              <p className="docspot-ask-preview-description">
                {search.askPreviewDescription}
              </p>
            </div>
            {page && (
              <div className="docspot-ask-context">
                <PageIcon size={16} />
                <div>
                  <div className="docspot-ask-context-label">
                    {search.askContextLabel}
                  </div>
                  <div className="docspot-ask-context-title">
                    {page.title ?? page.url}
                  </div>
                  <div className="docspot-ask-context-hint">
                    {search.askContextHint}
                  </div>
                </div>
              </div>
            )}
            <button
              type="button"
              className="docspot-button docspot-ask-send"
              onClick={onSelect}
            >
              <SendIcon size={16} />
              {chat.send}
            </button>
          </div>
        ) : item.conversation?.title ? (
          <p className="docspot-ask-preview-title">{item.conversation.title}</p>
        ) : (
          <Welcome
            title={chat.welcome}
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
