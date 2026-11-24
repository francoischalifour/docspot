import { useEffectEvent, useLayoutEffect } from 'react';

import { type SearchLeave, useDocspotInternal } from '@/core/context';
import { hasModifierKey, isExternalUrl } from '@/core/platform';
import { stripHash } from '@/core/url';
import type { DocspotResult } from '@/types';
import { cx } from '@/ui/cx';
import { useScrollEdges } from '@/ui/useScrollEdges';
import { PreviewErrorBoundary } from '@/search/PreviewErrorBoundary';
import { PreviewLink } from '@/search/PreviewLink';

type ResultPreviewProps = {
  result: DocspotResult;
  query: string;
  onClose: () => void;
  onLeave: SearchLeave;
  onNotify: (message: string) => void;
  onSelect: () => void;
};

export function ResultPreview({
  result,
  query,
  onClose,
  onLeave,
  onNotify,
  onSelect,
}: ResultPreviewProps) {
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
    onLeave(url, {});
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
                close={onClose}
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
            navigate={navigate}
            close={onClose}
            notify={onNotify}
          />
        )}
      </div>
    </section>
  );
}
