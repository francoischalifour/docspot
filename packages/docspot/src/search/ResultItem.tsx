import type { HTMLAttributes, MouseEvent } from 'react';

import { useDocspotInternal } from '@/core/Root';
import type { HighlightedText } from '@/types';
import {
  CommandIcon,
  EnterIcon,
  ExternalIcon,
  HistoryIcon,
  PageIcon,
  QuestionIcon,
  SectionIcon,
} from '@/ui/icons';
import { isExternalUrl } from '@/core/platform';
import { Kbd } from '@/ui/primitives';
import { type SearchItem, getEntryUrl, plain } from '@/search/model';

export function Highlight({ value }: { value: HighlightedText }) {
  return value.map((segment, index) =>
    segment.highlighted ? (
      <mark key={index} className="docspot-mark">
        {segment.text}
      </mark>
    ) : (
      segment.text
    )
  );
}

/** Joins breadcrumb parts, keeping each part's highlights. */
function BreadcrumbHighlight({
  parts,
  highlights,
}: {
  parts: string[];
  highlights: HighlightedText[] | undefined;
}) {
  return parts.map((part, index) => (
    <span key={index}>
      {index > 0 && ' › '}
      <Highlight value={highlights?.[index] ?? plain(part)} />
    </span>
  ));
}

/** Key names as `aria-keyshortcuts` writes them, drawn as on the keyboard. */
const shortcutKeys: Record<string, string> = {
  meta: '⌘',
  control: 'Ctrl',
  alt: '⌥',
  shift: 'shift',
  enter: 'enter',
  escape: 'esc',
  arrowup: 'up',
  arrowdown: 'down',
};

/** An item's shortcut, `Meta+S` as ⌘ S, unless the `shortcut` slot draws it. */
function Shortcut({ shortcut }: { shortcut: string }) {
  const { config } = useDocspotInternal('Docspot.SearchDialog');
  const Slot = config.slots.shortcut;
  if (Slot) return <Slot shortcut={shortcut} />;
  return (
    <Kbd
      variant="ghost"
      keys={shortcut
        .split('+')
        .map(key => shortcutKeys[key.toLowerCase()] ?? key.toUpperCase())}
    />
  );
}

export function ResultItem({
  item,
  itemProps,
  onNavigate,
  onSelect,
}: {
  item: SearchItem;
  itemProps: HTMLAttributes<HTMLElement>;
  onNavigate: (url: string, event: MouseEvent<HTMLAnchorElement>) => void;
  /** Chooses an item that opens no URL: asking AI, or a function action. */
  onSelect: () => void;
}) {
  const { config } = useDocspotInternal('Docspot.SearchDialog');
  const messages = config.messages.search;
  const ResultIcon = config.slots.resultIcon;
  const isActive =
    itemProps['aria-selected'] === true ||
    itemProps['aria-selected'] === 'true';

  const url = getEntryUrl(item);
  const result = item.kind === 'result' ? item.result : undefined;
  const shortcut = item.kind === 'item' ? item.item.shortcut : undefined;
  const breadcrumb = result?.breadcrumb ?? [];
  const isExternal = url !== undefined && isExternalUrl(url);

  let icon;
  if (item.kind === 'ask') icon = <QuestionIcon />;
  else if (item.kind === 'item')
    icon = item.item.icon ?? (url ? <PageIcon /> : <CommandIcon />);
  else if (ResultIcon)
    icon = <ResultIcon result={item.result} recent={item.recent} />;
  else if (item.recent) icon = <HistoryIcon />;
  else if (item.result.type === 'section') icon = <SectionIcon />;
  else icon = <PageIcon />;

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
                <Shortcut shortcut={shortcut} />
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
              {item.query && !config.slots.preview
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
          <ExternalIcon size={14} />
        ) : (
          isActive && (
            <span data-docspot-hints="">
              <EnterIcon size={14} />
            </span>
          )
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
        <div {...itemProps} className="docspot-result" onClick={onSelect}>
          {content}
        </div>
      )}
    </li>
  );
}
