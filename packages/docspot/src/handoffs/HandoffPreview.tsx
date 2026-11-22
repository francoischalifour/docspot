import { useDocspotInternal } from '@/core/context';
import type { DocspotItemPreviewProps } from '@/types';

/** Says what a handoff sends and where. */
export function HandoffPreview({ item, query }: DocspotItemPreviewProps) {
  const { config } = useDocspotInternal('Docspot.SearchDialog');
  const messages = config.messages.search;
  return (
    <>
      <h2 className="docspot-preview-title">{item.title}</h2>
      <p className="docspot-preview-text">{messages.quotedQuery(query)}</p>
      <p className="docspot-preview-hint">
        {item.description ?? messages.handoffDescription}
      </p>
    </>
  );
}
