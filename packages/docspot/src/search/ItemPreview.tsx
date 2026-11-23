import { type SearchLeave, useDocspotInternal } from '@/core/context';
import { type ItemOption, type SelectOptions, keepsOpen } from '@/search/model';
import { PreviewErrorBoundary } from '@/search/PreviewErrorBoundary';
import { PreviewLink } from '@/search/PreviewLink';

type ItemPreviewProps = {
  entry: ItemOption;
  onLeave: SearchLeave;
  onSelect: (item: ItemOption, options?: SelectOptions) => void;
};

/**
 * Names an item and says what it does, or shows its own preview, with a
 * button that runs it or opens its link.
 */
export function ItemPreview({ entry, onLeave, onSelect }: ItemPreviewProps) {
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
            onClick={event => onSelect(entry, { keepOpen: keepsOpen(event) })}
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
