import { useEffect, useRef, useState } from 'react';

import { useVisualViewport } from '@/core/platform';
import { SearchContext } from '@/search/SearchContext';
import { SearchFooter } from '@/search/SearchFooter';
import { SearchInput } from '@/search/SearchInput';
import { SearchList } from '@/search/SearchList';
import { SearchPreview } from '@/search/SearchPreview';
import { useSearch } from '@/search/useSearch';

/**
 * The search dialog, loaded once search is about to be used: `useSearch`
 * composed into a modal with its parts.
 */
export function SearchDialogFrame() {
  const search = useSearch();
  const { id, messages, canChat, hasPreview } = search;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [dialog, setDialog] = useState<HTMLDialogElement | null>(null);
  useVisualViewport(dialog);
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  return (
    <SearchContext value={search}>
      <dialog
        ref={element => {
          dialogRef.current = element;
          setDialog(element);
        }}
        data-docspot-search=""
        data-preview={hasPreview || undefined}
        className="docspot-search"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
        onCancel={event => {
          event.preventDefault();
          search.goBack();
        }}
        onClick={event => {
          if (event.target === event.currentTarget) search.close();
        }}
        onKeyDown={search.onKeyDown}
        onTouchMove={event => search.onTouchMove(event.nativeEvent)}
      >
        <div className="docspot-search-body">
          <h2 id={`${id}-title`} className="docspot-sr-only">
            {messages.title}
          </h2>
          <p id={`${id}-description`} className="docspot-sr-only">
            {canChat ? messages.descriptionWithAsk : messages.description}
          </p>
          <div className="docspot-search-header">
            <SearchInput />
            <button
              type="button"
              className="docspot-header-action"
              onClick={search.close}
            >
              {messages.close}
            </button>
          </div>
          <div className="docspot-search-main">
            <div className="docspot-search-results">
              <SearchList />
            </div>
            {hasPreview && <SearchPreview />}
          </div>
          <SearchFooter />
        </div>
      </dialog>
    </SearchContext>
  );
}
