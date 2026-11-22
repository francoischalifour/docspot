import type { DocspotPageActionsProps, DocspotPreviewProps } from 'docspot';
import type { ReactNode } from 'react';
import Markdown from 'react-markdown';

import { findPage, slugify } from './pages';

function text(children: ReactNode): string {
  if (typeof children === 'string' || typeof children === 'number')
    return String(children);
  if (Array.isArray(children)) return children.map(text).join('');
  return '';
}

/**
 * The `preview` slot: the result's page beside the results. Docspot scrolls
 * to the heading whose `id` matches the result URL's hash.
 */
export default function Preview({ result }: DocspotPreviewProps) {
  const page = findPage(result.url);
  if (!page) return <p>{result.excerpt}</p>;
  return (
    <Markdown
      components={{
        h2: ({ children }) => <h2 id={slugify(text(children))}>{children}</h2>,
      }}
    >
      {page.markdown}
    </Markdown>
  );
}

/** The `pageActions` slot: actions beside “Open page”. */
export function PageActions({ result, notify }: DocspotPageActionsProps) {
  const page = findPage(result.url);
  if (!page) return null;
  return (
    <button
      type="button"
      className="button"
      onClick={() =>
        void navigator.clipboard
          .writeText(page.markdown)
          .then(() => notify('Markdown copied'))
      }
    >
      Copy Markdown
    </button>
  );
}
