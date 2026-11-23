import type { DocspotMessages } from '@/messages';
import type { DocspotPage } from '@/types';
import { CloseIcon, PageIcon } from '@/ui/icons';
import { PageSlotIcon, SlotIcon } from '@/ui/SlotIcon';
import { useTooltip } from '@/ui/Tooltip';

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
  const withTooltip = useTooltip({
    label: messages.pageContextHint,
    side: 'top',
  });
  if (!page) return null;
  const title = page.title ?? page.url;
  return (
    <span className="docspot-context-chip">
      {withTooltip(
        <span className="docspot-context-chip-label">
          <PageSlotIcon
            page={page}
            icon={PageIcon}
            size={12}
            className="docspot-muted"
          />
          <span className="docspot-truncate">
            <span className="docspot-sr-only">{messages.pageContext}</span>
            {title}
          </span>
        </span>
      )}
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
