import { useState, useSyncExternalStore } from 'react';

import type { StoredConversation } from '@/core/storage';
import type { DocspotMessages } from '@/messages';
import { ChatIcon, ChevronDownIcon, DeleteIcon } from '@/ui/icons';
import { SlotIcon } from '@/ui/SlotIcon';
import { Menu } from '@/ui/Menu';
import type { ConversationProps } from '@/chat/contract';

type ConversationSwitcherProps = {
  current: StoredConversation | null;
  conversations: ConversationProps['conversations'];
  messages: DocspotMessages['chat'];
  onSelect: (conversation: StoredConversation) => void;
  onDeleteCurrent: () => void;
};

export function ConversationSwitcher({
  current,
  conversations,
  messages,
  onSelect,
  onDeleteCurrent,
}: ConversationSwitcherProps) {
  const saved = useSyncExternalStore(
    conversations.subscribe,
    conversations.list
  );
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const list =
    current && !saved.some(item => item.id === current.id)
      ? [current, ...saved]
      : saved;
  const title = current?.title ?? messages.newChat;

  return (
    <Menu
      className="docspot-switcher"
      onOpenChange={open => {
        if (!open) setIsConfirmingClear(false);
      }}
      trigger={props => (
        <button
          {...props}
          aria-label={messages.switchChat(title)}
          className="docspot-switcher-button"
        >
          <span className="docspot-truncate">{title}</span>
          <SlotIcon
            name="expand"
            icon={ChevronDownIcon}
            size={12}
            className="docspot-muted"
          />
        </button>
      )}
      items={
        list.length
          ? [
              { kind: 'label', key: 'label', label: messages.recentChats },
              ...list.map(conversation => {
                const isCurrent = conversation.id === current?.id;
                return {
                  key: conversation.id,
                  label: conversation.title,
                  icon: <SlotIcon name="conversation" icon={ChatIcon} />,
                  current: isCurrent,
                  onSelect: () => {
                    if (!isCurrent) onSelect(conversation);
                  },
                  secondary: {
                    label: messages.deleteChat(conversation.title),
                    icon: (
                      <SlotIcon name="delete" icon={DeleteIcon} size={14} />
                    ),
                    onSelect: () => {
                      conversations.remove(conversation.id);
                      if (isCurrent) onDeleteCurrent();
                    },
                  },
                };
              }),
              { kind: 'separator', key: 'separator' },
              {
                key: 'clear',
                label: isConfirmingClear
                  ? messages.confirmClearHistory
                  : messages.clearHistory,
                icon: <SlotIcon name="delete" icon={DeleteIcon} />,
                // Quiet until it asks to confirm.
                quiet: !isConfirmingClear,
                danger: isConfirmingClear,
                keepOpen: !isConfirmingClear,
                onSelect: () => {
                  if (!isConfirmingClear) {
                    setIsConfirmingClear(true);
                    return;
                  }
                  conversations.clear();
                  if (current) onDeleteCurrent();
                },
              },
            ]
          : [{ kind: 'text', key: 'empty', label: messages.noRecentChats }]
      }
    />
  );
}
