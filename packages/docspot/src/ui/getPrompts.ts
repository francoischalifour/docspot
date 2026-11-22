import type { DocspotPage } from '@/types';

/** The questions to offer for a page: its own, or the defaults. */
export function getPrompts(page: DocspotPage | undefined, prompts: string[]) {
  return page?.prompts?.length ? page.prompts : prompts;
}
