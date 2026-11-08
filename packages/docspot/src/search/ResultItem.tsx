import type { HTMLAttributes, MouseEvent } from 'react';

import { useDocspotInternal } from '../core/Root';
import type { HighlightedText } from '../types';
import {
  EnterIcon,
  ExternalIcon,
  HistoryIcon,
  PageIcon,
  QuestionIcon,
  SectionIcon,
} from '../ui/icons';
import { isExternalUrl } from '../core/platform';
import { type SearchItem, getBreadcrumbText, getItemUrl, plain } from './model';

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

export function ResultItem({
  item,
  itemProps,
  onNavigate,
  onAsk,
}: {
  item: SearchItem;
  itemProps: HTMLAttributes<HTMLElement>;
  onNavigate: (url: string, event: MouseEvent<HTMLAnchorElement>) => void;
  onAsk: () => void;
}) {
  const { config } = useDocspotInternal('Docspot.SearchDialog');
  const messages = config.messages.search;
  const ResultIcon = config.slots.resultIcon;
  const isActive =
    itemProps['aria-selected'] === true ||
    itemProps['aria-selected'] === 'true';

  const url = getItemUrl(item);
  const isExternal = item.kind === 'handoff' || (url && isExternalUrl(url));

  let icon;
  if (item.kind === 'ask') icon = <QuestionIcon />;
  else if (item.kind === 'handoff')
    icon = item.handoff.icon ?? <QuestionIcon />;
  else if (ResultIcon)
    icon = <ResultIcon result={item.result} recent={item.recent} />;
  else if (item.recent) icon = <HistoryIcon />;
  else if (item.result.type === 'section') icon = <SectionIcon />;
  else icon = <PageIcon />;

  const content = (
    <>
      {/* Icons sit on the title's first line; lines below span the full width. */}
      <span className="docspot-result-icon">{icon}</span>
      <div className="docspot-result-title">
        {item.kind === 'page' ? (
          <Highlight
            value={item.result.highlights?.title ?? plain(item.result.title)}
          />
        ) : item.kind === 'handoff' ? (
          item.handoff.title
        ) : (
          item.title
        )}
      </div>
      {item.kind === 'page' ? (
        getBreadcrumbText(item.result) && (
          <p className="docspot-result-path">
            <BreadcrumbHighlight
              parts={item.result.breadcrumb ?? []}
              highlights={item.result.highlights?.breadcrumb}
            />
          </p>
        )
      ) : (
        <p className="docspot-result-path" data-ask="">
          {item.query
            ? messages.quotedQuery(item.query)
            : item.kind === 'ask' && item.conversation
              ? messages.continueConversation
              : messages.askDescription}
        </p>
      )}
      {item.kind === 'page' && item.query && item.result.excerpt && (
        <p className="docspot-result-excerpt">
          <Highlight
            value={
              item.result.highlights?.excerpt ?? plain(item.result.excerpt)
            }
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
          // Results on other sites, such as handoffs, open in a new tab.
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
        <div {...itemProps} className="docspot-result" onClick={onAsk}>
          {content}
        </div>
      )}
    </li>
  );
}
