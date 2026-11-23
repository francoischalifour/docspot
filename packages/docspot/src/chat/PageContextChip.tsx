import type { DocspotMessages } from '@/messages';
import type { DocspotPage } from '@/types';
import { CloseIcon, PageIcon } from '@/ui/icons';
import { SlotIcon } from '@/ui/SlotIcon';

type PageContextChipProps = {
  page: DocspotPage | undefined;
  onRemove: () => void;
  messages: DocspotMessages['chat'];
};

/** The page attached to a question; questions without one use all the docs. */
export function PageContextChip({
  page,
  onRemove,
  messages,
}: PageContextChipProps) {
  if (!page) return null;
  const title = page.title ?? page.url;
  return (
    <span className="docspot-context-chip">
      <span className="docspot-tooltip-anchor" data-side="top">
        <span className="docspot-context-chip-label">
          <SlotIcon
            name="page"
            icon={PageIcon}
            size={12}
            className="docspot-muted"
          />
          <span className="docspot-truncate">
            <span className="docspot-sr-only">{messages.pageContext}</span>
            {title}
          </span>
        </span>
        <span className="docspot-tooltip" aria-hidden="true">
          {messages.pageContextHint}
        </span>
      </span>
      <button
        type="button"
        className="docspot-context-chip-remove"
        aria-label={messages.removePageContext}
        onClick={onRemove}
      >
        <SlotIcon name="close" icon={CloseIcon} size={12} />
      </button>
    </span>
  );
}
