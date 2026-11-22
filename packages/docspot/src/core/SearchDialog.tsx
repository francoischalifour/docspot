import { Suspense, lazy } from 'react';

import { searchDialogFrameLoader, useDocspotInternal } from '@/core/context';

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
    <Suspense>
      <Dialog />
    </Suspense>
  );
}
