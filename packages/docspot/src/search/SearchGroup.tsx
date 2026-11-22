import { OptionRow } from '@/search/OptionRow';
import { useSearchContext } from '@/search/SearchContext';
import type { SearchGroupModel } from '@/search/useSearch';

type SearchGroupProps = { group: SearchGroupModel };

/** A labeled group of options; recent pages can be cleared from here. */
export function SearchGroup({ group }: SearchGroupProps) {
  const search = useSearchContext('SearchGroup');
  const { messages, config } = search;
  return (
    <section
      aria-label={group.label}
      className="docspot-search-group"
      inert={group.isStale}
      aria-hidden={group.isStale || undefined}
    >
      <div className="docspot-search-group-header">
        <h3 className="docspot-truncate" title={group.label}>
          {group.label}
        </h3>
        {group.isRecent && (
          <button
            type="button"
            className="docspot-text-button"
            onClick={search.clearRecent}
          >
            {messages.clearHistory}
          </button>
        )}
      </div>
      <ul {...search.getListProps(group)}>
        {group.options.map(option => (
          <OptionRow
            key={option.id}
            item={search.withLiveQuery(option)}
            itemProps={search.getOptionProps(option, group)}
            messages={messages}
            slots={config.slots}
            // Asking and actions do not wait for pending results.
            onSelect={search.selectOption}
            onNavigate={search.openOptionLink}
          />
        ))}
      </ul>
    </section>
  );
}
