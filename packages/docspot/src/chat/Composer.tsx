import type { Ref } from 'react';

import type { DocspotMessages } from '@/messages';
import type { DocspotPage } from '@/types';
import { SendIcon, StopIcon } from '@/ui/icons';
import { SlotIcon } from '@/ui/SlotIcon';
import { IconButton } from '@/ui/IconButton';
import { PageContextChip } from '@/chat/PageContextChip';

type ComposerProps = {
  inputRef: Ref<HTMLTextAreaElement>;
  draft: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  busy: boolean;
  onStop: () => void;
  contextPage: DocspotPage | undefined;
  onRemoveContext: () => void;
  messages: DocspotMessages['chat'];
  label: string;
  placeholder: string;
};

export function Composer({
  inputRef,
  draft,
  onChange,
  onSubmit,
  busy,
  onStop,
  contextPage,
  onRemoveContext,
  messages,
  label,
  placeholder,
}: ComposerProps) {
  const disabled = !busy && !draft.trim();
  return (
    <form
      className="docspot-composer"
      onSubmit={event => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <textarea
        ref={inputRef}
        enterKeyHint="send"
        aria-label={label}
        aria-keyshortcuts="Enter"
        aria-description={messages.composerDescription}
        placeholder={placeholder}
        value={draft}
        rows={1}
        className="docspot-composer-input"
        onChange={event => onChange(event.currentTarget.value)}
        onKeyDown={event => {
          // Safari reports keys that end a composition with keyCode 229.
          // oxlint-disable-next-line typescript/no-deprecated
          if (event.nativeEvent.isComposing || event.keyCode === 229) {
            event.stopPropagation();
            return;
          }
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            onSubmit();
          }
        }}
      />
      <div className="docspot-composer-bar">
        <PageContextChip
          page={contextPage}
          onRemove={onRemoveContext}
          messages={messages}
        />
        {/* Its own box, so the button stays at the end with any tooltip. */}
        <div className="docspot-composer-send">
          <IconButton
            type={busy ? 'button' : 'submit'}
            label={busy ? messages.stop : messages.send}
            tooltip={disabled ? messages.enterQuestion : undefined}
            side="top"
            aria-disabled={disabled || undefined}
            data-variant={busy ? 'outline' : 'primary'}
            className="docspot-send"
            onClick={event => {
              if (busy) onStop();
              else if (disabled) event.preventDefault();
            }}
          >
            {busy ? (
              <SlotIcon name="stop" icon={StopIcon} size={14} />
            ) : (
              <SlotIcon name="send" icon={SendIcon} size={14} />
            )}
          </IconButton>
        </div>
      </div>
    </form>
  );
}
