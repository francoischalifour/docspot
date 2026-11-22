import { CheckIcon, CopyIcon } from '@/ui/icons';
import { IconButton } from '@/ui/IconButton';
import { useClipboard } from '@/ui/useClipboard';

type CopyButtonProps = {
  text: string;
  label: string;
  copiedLabel: string;
};

export function CopyButton({ text, label, copiedLabel }: CopyButtonProps) {
  const { isCopied, copy } = useClipboard();
  return (
    <IconButton
      label={isCopied ? copiedLabel : label}
      side="top"
      className="docspot-message-action"
      onClick={() => void copy(text).catch(() => {})}
    >
      {isCopied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
    </IconButton>
  );
}
