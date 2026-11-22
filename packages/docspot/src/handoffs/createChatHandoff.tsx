import type { ReactNode } from 'react';

import { HandoffPreview } from '@/handoffs/HandoffPreview';
import type { DocspotHandoff, DocspotHandoffContext } from '@/types';

export type ChatHandoffOptions = {
  /**
   * The message the chat starts with. Defaults to the query; add a link to
   * the best result so the assistant reads your docs.
   */
  prompt?: (context: DocspotHandoffContext) => string;
  /** Item title. */
  title?: string;
  /** Explains the handoff in the preview. */
  description?: string;
  /** Replaces the service's logo. */
  icon?: ReactNode;
};

/** Builds a handoff that opens a chat service with the query. */
export function createChatHandoff(
  defaults: { id: string; title: string; icon: ReactNode; url: string },
  {
    prompt = ({ query }) => query,
    title,
    description,
    icon,
  }: ChatHandoffOptions
): DocspotHandoff {
  return context => {
    const url = new URL(defaults.url);
    url.searchParams.set('q', prompt(context));
    return {
      id: defaults.id,
      title: title ?? defaults.title,
      action: url.href,
      icon: icon ?? defaults.icon,
      description,
      preview: HandoffPreview,
    };
  };
}

/** Props for a service's logo, drawn in the item's icon slot. */
export const iconProps = {
  'aria-hidden': true,
  focusable: false,
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'currentColor',
} as const;
