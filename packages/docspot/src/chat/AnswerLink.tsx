import type { MouseEvent, ReactNode } from 'react';

import { hasModifierKey } from '@/core/platform';

type AnswerLinkProps = {
  href: string | undefined;
  onNavigate: (url: string, event: MouseEvent<HTMLAnchorElement>) => void;
  toInternalUrl: (url: string) => string | null;
  externalIcon: ReactNode;
  children: ReactNode;
};

/**
 * Links to this site open in place, like links in the docs themselves;
 * links elsewhere open in a new tab.
 */
export function AnswerLink({
  href,
  onNavigate,
  toInternalUrl,
  externalIcon,
  children,
}: AnswerLinkProps) {
  const internal = href ? toInternalUrl(href) : null;
  return internal ? (
    <a
      href={internal}
      onClick={event => {
        if (event.button !== 0 || hasModifierKey(event)) return;
        onNavigate(internal, event);
      }}
    >
      {children}
    </a>
  ) : (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      {externalIcon}
    </a>
  );
}
