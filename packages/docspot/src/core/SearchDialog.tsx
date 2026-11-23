import { Suspense, lazy, useLayoutEffect } from 'react';

import {
  type SearchController,
  searchDialogFrameLoader,
  useDocspotInternal,
} from '@/core/context';

const LazySearchDialog = /* @__PURE__ */ lazy(() =>
  searchDialogFrameLoader
    .load()
    .then(module => ({ default: module.SearchDialogFrame }))
);

/** The search dialog, rendered while search is open. */
export function SearchDialog() {
  const { config, search } = useDocspotInternal('Docspot.SearchDialog');
  if (!config.canSearch || !search.isOpen) return null;
  // Once preloaded, the dialog renders in the same frame; lazy would wait one.
  const Dialog =
    searchDialogFrameLoader.get()?.SearchDialogFrame ?? LazySearchDialog;
  return (
    <Suspense fallback={<TypedQuery search={search} />}>
      <Dialog />
    </Suspense>
  );
}

/**
 * Keeps what is typed while the dialog loads, so the query it opens with
 * is complete. Escape closes search.
 */
function TypedQuery({ search }: { search: SearchController }) {
  useLayoutEffect(() => {
    let query = search.query;
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        search.close();
        return;
      }
      if (event.key === 'Backspace') query = query.slice(0, -1);
      else if (event.key.length === 1) query += event.key;
      else return;
      event.preventDefault();
      search.setQuery(query);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
  return null;
}
