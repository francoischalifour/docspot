import { Kbd } from '@/ui/Kbd';
import { useSearchContext } from '@/search/SearchContext';

/** Key hints, what screen readers hear about results, and branding. */
export function SearchFooter() {
  const search = useSearchContext('SearchFooter');
  const { messages, activeOption, config } = search;
  const Branding = config.slots.branding;
  return (
    <footer className="docspot-search-footer">
      <div data-docspot-hints="" aria-hidden="true" className="docspot-hints">
        <span>
          <Kbd keys={['esc']} />{' '}
          {search.rawQuery ? messages.toClear : messages.toClose}
        </span>
        <span>
          <span className="docspot-kbd-pair">
            <Kbd keys={['up']} />
            <Kbd keys={['down']} />
          </span>
          {messages.toNavigate}
        </span>
        <span
          title={
            activeOption?.kind === 'ask' && !activeOption.conversation
              ? messages.enterToAsk
              : undefined
          }
        >
          <Kbd keys={['enter']} />{' '}
          {activeOption?.kind === 'ask'
            ? activeOption.conversation
              ? messages.continueChat
              : messages.askAi
            : messages.toOpen}
        </span>
      </div>
      <span
        className="docspot-sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {search.isLeaving
          ? messages.opening
          : search.isLoading
            ? messages.searching
            : search.hasError
              ? messages.unavailable
              : search.query
                ? messages.resultCount(search.resultCount)
                : messages.title}
      </span>
      {search.statusMessage && (
        <span className="docspot-toast" role="status">
          {search.statusMessage}
        </span>
      )}
      {Branding && (
        <div className="docspot-branding">
          <Branding />
        </div>
      )}
    </footer>
  );
}
