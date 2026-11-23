import { CloseIcon, CollapseIcon, NewChatIcon } from '@/ui/icons';
import { SlotIcon } from '@/ui/SlotIcon';
import { IconButton } from '@/ui/IconButton';
import { ConversationSwitcher } from '@/chat/ConversationSwitcher';
import { useConversationContext } from '@/chat/ConversationContext';

/** Switches conversations, starts a new one, and hides the panel. */
export function ConversationHeader() {
  const conversation = useConversationContext('ConversationHeader');
  const { messages } = conversation;
  return (
    <div className="docspot-chat-header">
      <ConversationSwitcher
        current={conversation.current}
        conversations={conversation.conversations}
        messages={messages}
        onSelect={conversation.onSelectConversation}
        onDeleteCurrent={conversation.deleteCurrent}
      />
      {conversation.chatMessages.length > 0 && (
        <IconButton
          label={messages.newChat}
          onClick={conversation.onNewConversation}
        >
          <SlotIcon name="newChat" icon={NewChatIcon} size={16} />
        </IconButton>
      )}
      <IconButton
        label={messages.hide}
        shortcut={['esc']}
        onClick={conversation.onClose}
      >
        {/* Slides away beside the page; closes when it covers the screen. */}
        <SlotIcon
          name="collapse"
          icon={CollapseIcon}
          size={16}
          className="docspot-when-docked"
        />
        <SlotIcon
          name="close"
          icon={CloseIcon}
          size={16}
          className="docspot-when-covering"
        />
      </IconButton>
    </div>
  );
}
