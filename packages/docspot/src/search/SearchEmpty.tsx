import { SearchIcon } from '@/ui/icons';
import { SlotIcon } from '@/ui/SlotIcon';
import { Shimmer } from '@/ui/Shimmer';
import { useSearchContext } from '@/search/SearchContext';

/** What the list says when it has no pages: loading, failed, or empty. */
export function SearchEmpty() {
  const search = useSearchContext('SearchEmpty');
  const { messages, isLoading, hasError, query, emptyHint } = search;
  return (
    <div className="docspot-search-empty">
      {!isLoading && (
        <SlotIcon
          name="search"
          icon={SearchIcon}
          size={20}
          className="docspot-subtle"
        />
      )}
      <p className="docspot-search-empty-title">
        {isLoading ? (
          <Shimmer>{messages.loading}</Shimmer>
        ) : hasError ? (
          messages.error
        ) : query ? (
          messages.noResults(search.rawQuery)
        ) : (
          messages.emptyTitle
        )}
      </p>
      {emptyHint && <p className="docspot-search-empty-hint">{emptyHint}</p>}
      {!isLoading && hasError && (
        <button type="button" className="docspot-button" onClick={search.retry}>
          {messages.retry}
        </button>
      )}
    </div>
  );
}
