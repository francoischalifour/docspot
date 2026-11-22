import type { MouseEvent } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { ExternalIcon } from '@/ui/icons';
import { completeStreamingMarkdown } from '@/chat/messages';
import { AnswerLink } from '@/chat/AnswerLink';

type MarkdownProps = {
  text: string;
  streaming: boolean;
  onNavigate: (url: string, event: MouseEvent<HTMLAnchorElement>) => void;
  toInternalUrl: (url: string) => string | null;
};

export function Markdown({
  text,
  streaming,
  onNavigate,
  toInternalUrl,
}: MarkdownProps) {
  const components: Components = {
    a: ({ href, children }) => (
      <AnswerLink
        href={href}
        onNavigate={onNavigate}
        toInternalUrl={toInternalUrl}
        externalIcon={
          <ExternalIcon size={12} className="docspot-external-icon" />
        }
      >
        {children}
      </AnswerLink>
    ),
  };
  return (
    <div className="docspot-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {streaming ? completeStreamingMarkdown(text) : text}
      </ReactMarkdown>
    </div>
  );
}
