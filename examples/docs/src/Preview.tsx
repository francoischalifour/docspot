import type { DocspotPageActionsProps, DocspotPreviewProps } from 'docspot';
import { PageMarkdown } from './PageMarkdown';
import { findPage } from './pages';

/**
 * The `preview` slot: the result's page beside the results. Docspot scrolls
 * to the heading whose `data-docspot-anchor` matches the result URL's hash.
 */
export default function Preview({ result }: DocspotPreviewProps) {
  const page = findPage(result.url);
  if (!page) return <p>{result.excerpt}</p>;
  return <PageMarkdown preview>{page.markdown}</PageMarkdown>;
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
