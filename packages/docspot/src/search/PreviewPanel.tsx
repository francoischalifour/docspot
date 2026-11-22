import { Suspense, useDeferredValue } from 'react';

import type { ChatRequest, SearchLeave } from '@/core/context';
import { cx } from '@/ui/cx';
import type { SearchOption } from '@/search/model';
import { ResultPreview } from '@/search/ResultPreview';
import { ItemPreview } from '@/search/ItemPreview';
import { AskPreview } from '@/search/AskPreview';
import { PreviewLoading } from '@/search/PreviewLoading';

type PreviewPanelProps = {
  activeItem: SearchOption | undefined;
  query: string;
  isLoading: boolean;
  onClose: () => void;
  /** Closes search to follow a link, keeping the query for Back. */
  onLeave: SearchLeave;
  onNotify: (message: string) => void;
  onStartChat: (request?: ChatRequest) => void;
  /** Chooses an item from its preview: runs it, or records the link opened. */
  onSelect: (item: SearchOption) => void;
};

export function PreviewPanel({
  activeItem,
  query,
  isLoading,
  onClose,
  onLeave,
  onNotify,
  onStartChat,
  onSelect,
}: PreviewPanelProps) {
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
