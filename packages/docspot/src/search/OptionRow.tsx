import { type HTMLAttributes, type MouseEvent, memo } from 'react';

import type { DocspotMessages } from '@/messages';
import type { DocspotSlots } from '@/types';
import {
  CommandIcon,
  EnterIcon,
  ExternalIcon,
  HistoryIcon,
  PageIcon,
  QuestionIcon,
  SectionIcon,
} from '@/ui/icons';
import { SlotIcon } from '@/ui/SlotIcon';
import { isExternalUrl } from '@/core/platform';
import {
  type SearchOption,
  type SelectOptions,
  getOptionUrl,
  keepsOpen,
  plain,
} from '@/search/model';
import { Highlight } from '@/search/Highlight';
import { BreadcrumbHighlight } from '@/search/BreadcrumbHighlight';
import { Shortcut } from '@/search/Shortcut';

/** Result icons are drawn larger than inline ones; see `.docspot-result-icon`. */
const ROW_ICON_SIZE = 18;

type OptionRowProps = {
  item: SearchOption;
  itemProps: HTMLAttributes<HTMLElement>;
  messages: DocspotMessages['search'];
  slots: DocspotSlots;
  /** Stable: reads the dialog's latest state. */
  onNavigate: (url: string, event: MouseEvent<HTMLAnchorElement>) => void;
  /**
   * Chooses an item that opens no URL: asking AI, or a function action.
   * Stable: reads the dialog's latest state.
   */
  onSelect: (item: SearchOption, options?: SelectOptions) => void;
};

/**
 * A row renders when its item or its selection changes, not when another
 * row is selected. Autocomplete's handlers in `itemProps` act on its own
 * store, so a row's earlier handlers stay valid.
 */
export const OptionRow = memo(
  OptionRowContent,
  (previous, next) =>
    previous.item === next.item &&
    previous.messages === next.messages &&
    previous.slots === next.slots &&
    previous.onNavigate === next.onNavigate &&
    previous.onSelect === next.onSelect &&
    previous.itemProps.id === next.itemProps.id &&
    previous.itemProps['aria-selected'] === next.itemProps['aria-selected']
);

function OptionRowContent({
  item,
  itemProps,
  messages,
  slots,
  onNavigate,
  onSelect,
}: OptionRowProps) {
  const ResultIcon = slots.resultIcon;

  const url = getOptionUrl(item);
  const result = item.kind === 'result' ? item.result : undefined;
  const shortcut = item.kind === 'item' ? item.item.shortcut : undefined;
  const breadcrumb = result?.breadcrumb ?? [];
  const isExternal = url !== undefined && isExternalUrl(url);

  // Drawn at the size the row shows them, so their stroke matches others'.
  let icon;
  if (item.kind === 'ask')
    icon = <SlotIcon name="ask" icon={QuestionIcon} size={ROW_ICON_SIZE} />;
  else if (item.kind === 'item')
    icon =
      item.item.icon ??
      (url ? (
        <SlotIcon name="page" icon={PageIcon} size={ROW_ICON_SIZE} />
      ) : (
        <SlotIcon name="action" icon={CommandIcon} size={ROW_ICON_SIZE} />
      ));
  else if (ResultIcon)
    icon = (
      <ResultIcon
        result={item.result}
        recent={item.recent}
        size={ROW_ICON_SIZE}
        aria-hidden
        focusable="false"
      />
    );
  else if (item.recent)
    icon = <SlotIcon name="recent" icon={HistoryIcon} size={ROW_ICON_SIZE} />;
  else if (item.result.type === 'section')
    icon = <SlotIcon name="section" icon={SectionIcon} size={ROW_ICON_SIZE} />;
  else icon = <SlotIcon name="page" icon={PageIcon} size={ROW_ICON_SIZE} />;

  const content = (
    <>
      {/* Icons sit on the title's first line; lines below span the full width. */}
      <span className="docspot-result-icon">{icon}</span>
      <div
        className="docspot-result-title"
        data-shortcut={shortcut ? '' : undefined}
      >
        {item.kind === 'ask' ? (
          item.title
        ) : (
          <>
            <span>
              <Highlight value={item.title} />
            </span>
            {shortcut && (
              <span className="docspot-result-shortcut">
                <Shortcut shortcut={shortcut} slots={slots} />
              </span>
            )}
          </>
        )}
      </div>
      {result
        ? breadcrumb.length > 0 && (
            <p className="docspot-result-path">
              <BreadcrumbHighlight
                parts={breadcrumb}
                highlights={result.highlights?.breadcrumb}
              />
            </p>
          )
        : item.kind === 'ask' &&
          !item.prompt && (
            <p className="docspot-result-path" data-ask="">
              {item.query && !slots.preview
                ? messages.quotedQuery(item.query)
                : item.conversation
                  ? messages.continueChat
                  : messages.askDescription}
            </p>
          )}
      {result && item.query && result.excerpt && (
        <p className="docspot-result-excerpt">
          <Highlight
            value={result.highlights?.excerpt ?? plain(result.excerpt)}
          />
        </p>
      )}
      <span aria-hidden="true" className="docspot-result-hint">
        {isExternal ? (
          <SlotIcon name="external" icon={ExternalIcon} size={14} />
        ) : (
          // Shown on the selected row by CSS, so moving the selection
          // renders only the rows it leaves and reaches.
          <span data-docspot-hints="" className="docspot-result-enter">
            <SlotIcon name="enter" icon={EnterIcon} size={14} />
          </span>
        )}
      </span>
    </>
  );

  return (
    <li role="presentation">
      {url ? (
        <a
          {...itemProps}
          href={url}
          // Links to other sites, such as handoffs, open in a new tab.
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noopener noreferrer' : undefined}
          tabIndex={-1}
          className="docspot-result"
          onClick={event => {
            itemProps.onClick?.(event);
            onNavigate(url, event);
          }}
        >
          {content}
        </a>
      ) : (
        <div
          {...itemProps}
          className="docspot-result"
          onClick={event => onSelect(item, { keepOpen: keepsOpen(event) })}
        >
          {content}
        </div>
      )}
    </li>
  );
}
