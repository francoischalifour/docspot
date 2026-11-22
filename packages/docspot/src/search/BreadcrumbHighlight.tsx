import type { HighlightedText } from '@/types';
import { plain } from '@/search/model';
import { Highlight } from '@/search/Highlight';

type BreadcrumbHighlightProps = {
  parts: string[];
  highlights: HighlightedText[] | undefined;
};

/** Joins breadcrumb parts, keeping each part's highlights. */
export function BreadcrumbHighlight({
  parts,
  highlights,
}: BreadcrumbHighlightProps) {
  return parts.map((part, index) => (
    <span key={index}>
      {index > 0 && ' › '}
      <Highlight value={highlights?.[index] ?? plain(part)} />
    </span>
  ));
}
