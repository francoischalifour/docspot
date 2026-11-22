import { useDocspotInternal } from '@/core/context';
import { hasModifierKey, isExternalUrl } from '@/core/platform';
import { ExternalIcon } from '@/ui/icons';

type PreviewLinkProps = {
  url: string;
  onSelect: () => void;
  onLeave: () => void;
};

/** Records the selection and leaves modified clicks to the browser. */
export function PreviewLink({ url, onSelect, onLeave }: PreviewLinkProps) {
  const { config } = useDocspotInternal('Docspot.SearchDialog');
  const external = isExternalUrl(url);
  return (
    <a
      href={url}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className="docspot-button docspot-button-ghost"
      onClick={event => {
        onSelect();
        if (external || event.button !== 0 || hasModifierKey(event)) return;
        event.preventDefault();
        onLeave();
        config.navigate(url, { event });
      }}
    >
      {external
        ? config.messages.search.openLink
        : config.messages.search.openPage}
      {external && <ExternalIcon size={12} />}
    </a>
  );
}
