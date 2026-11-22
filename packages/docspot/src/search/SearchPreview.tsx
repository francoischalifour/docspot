import { useDocspotInternal } from '@/core/context';
import { PreviewPanel } from '@/search/PreviewPanel';
import { useSearchContext } from '@/search/SearchContext';

/** The active option's preview, beside the list. */
export function SearchPreview() {
  const { search: controller } = useDocspotInternal('Docspot.SearchDialog');
  const search = useSearchContext('SearchPreview');
  return (
    <PreviewPanel
      activeItem={search.activeOption}
      query={search.query}
      isLoading={search.isLoading}
      onClose={search.close}
      onLeave={controller.leave}
      onNotify={search.announce}
      onStartChat={search.openChat}
      onSelect={search.selectOption}
    />
  );
}
