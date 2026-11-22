import { useDocspotInternal } from '@/core/context';

export function PreviewLoading() {
  const { config } = useDocspotInternal('Docspot.SearchDialog');
  return (
    <div
      role="status"
      aria-label={config.messages.search.loadingPreview}
      className="docspot-preview-skeleton"
    >
      <div aria-hidden="true" className="docspot-skeleton-body">
        <div className="docspot-skeleton-line" style={{ width: '7rem' }} />
        <div className="docspot-skeleton-heading" />
        {[3, 2].map((lines, index) => (
          <div key={index} className="docspot-skeleton-paragraph">
            {Array.from({ length: lines }, (_, line) => (
              <div key={line} className="docspot-skeleton-line" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
