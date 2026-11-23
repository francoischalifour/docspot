import { CheckIcon, CopyIcon } from '@/ui/icons';
import { SlotIcon } from '@/ui/SlotIcon';
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
      {isCopied ? (
        <SlotIcon name="copied" icon={CheckIcon} size={14} />
      ) : (
        <SlotIcon name="copy" icon={CopyIcon} size={14} />
      )}
    </IconButton>
  );
}
