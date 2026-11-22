import { LoadingIcon, SearchIcon } from '@/ui/icons';
import { useSearchContext } from '@/search/SearchContext';

/** The query field, labeled, with a spinner while results are slow. */
export function SearchInput() {
  const search = useSearchContext('SearchInput');
  return (
    <form {...search.getFormProps()} className="docspot-search-form">
      <label {...search.getLabelProps()} className="docspot-sr-only">
        {search.messages.title}
      </label>
      {search.status === 'stalled' ? (
        <LoadingIcon size={20} className="docspot-spin docspot-muted" />
      ) : (
        <SearchIcon size={20} className="docspot-muted" />
      )}
      <input
        {...search.getInputProps()}
        autoFocus
        className="docspot-search-input"
      />
    </form>
  );
}
