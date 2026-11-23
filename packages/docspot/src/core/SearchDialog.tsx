import { Suspense, lazy } from 'react';

import {
  type SearchController,
  searchDialogFrameLoader,
  useDocspotInternal,
} from '@/core/context';
import { useTypedText } from '@/core/platform';

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

/** Keeps what is typed while the dialog loads, for the query it opens with. */
function TypedQuery({ search }: { search: SearchController }) {
  useTypedText(search.query, search.setQuery, search.close);
  return null;
}
