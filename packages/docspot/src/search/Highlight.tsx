import type { HighlightedText } from '@/types';

type HighlightProps = { value: HighlightedText };

export function Highlight({ value }: HighlightProps) {
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
