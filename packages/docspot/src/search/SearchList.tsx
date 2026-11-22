import { cx } from '@/ui/cx';
import { SearchEmpty } from '@/search/SearchEmpty';
import { SearchGroup } from '@/search/SearchGroup';
import { useSearchContext } from '@/search/SearchContext';

/** The options for the query, in groups, or what to do when there are none. */
export function SearchList() {
  const search = useSearchContext('SearchList');
  return (
    <div
      ref={search.list.ref}
      className={cx(
        'docspot-search-list',
        search.list.canScrollDown && 'docspot-fade-bottom',
        search.status === 'stalled' && 'docspot-stalled'
      )}
      aria-busy={search.isLoading}
    >
      {!search.hasVisiblePages && <SearchEmpty />}
      {search.groups.map(group => (
        <SearchGroup key={group.id} group={group} />
      ))}
    </div>
  );
}
