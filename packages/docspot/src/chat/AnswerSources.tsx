import type { SourceUrlUIPart } from 'ai';
import type { MouseEvent } from 'react';

import type { DocspotMessages } from '@/messages';
import { ArrowUpRightIcon } from '@/ui/icons';
import { AnswerLink } from '@/chat/AnswerLink';

type AnswerSourcesProps = {
  sources: SourceUrlUIPart[];
  messages: DocspotMessages['chat'];
  onNavigate: (url: string, event: MouseEvent<HTMLAnchorElement>) => void;
  toInternalUrl: (url: string) => string | null;
};

/** The pages an answer cites. Pages on this site open in place. */
export function AnswerSources({
  sources,
  messages,
  onNavigate,
  toInternalUrl,
}: AnswerSourcesProps) {
  if (!sources.length) return null;
  return (
    <div className="docspot-sources">
      <h3>{messages.sources}</h3>
      <ul>
        {sources.map(source => (
          <li key={source.sourceId}>
            <AnswerLink
              href={source.url}
              onNavigate={onNavigate}
              toInternalUrl={toInternalUrl}
              externalIcon={null}
            >
              {source.title ?? messages.sourceFallback}
              <ArrowUpRightIcon size={12} />
            </AnswerLink>
          </li>
        ))}
      </ul>
    </div>
  );
}
