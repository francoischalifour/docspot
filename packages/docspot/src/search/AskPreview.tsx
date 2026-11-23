import { type ChatRequest, useDocspotInternal } from '@/core/context';
import { PageIcon, QuestionIcon, SendIcon } from '@/ui/icons';
import { PageSlotIcon, SlotIcon } from '@/ui/SlotIcon';
import { Welcome } from '@/ui/Welcome';
import { getPrompts } from '@/ui/getPrompts';
import type { AskOption } from '@/search/model';

type AskPreviewProps = {
  item: AskOption;
  onStartChat: (request?: ChatRequest) => void;
  onSelect: () => void;
};

export function AskPreview({ item, onStartChat, onSelect }: AskPreviewProps) {
  const { config } = useDocspotInternal('Docspot.SearchDialog');
  const { search, chat } = config.messages;
  const page = config.currentPage;
  return (
    <section aria-label={search.askPreview} className="docspot-ask-preview">
      <div className="docspot-ask-preview-inner">
        {item.query || item.prompt ? (
          <div className="docspot-ask-ready">
            <span className="docspot-ask-preview-icon">
              <SlotIcon name="ask" icon={QuestionIcon} size={22} />
            </span>
            <div>
              <h3 className="docspot-ask-preview-title">{chat.welcome}</h3>
              <p className="docspot-ask-preview-description">
                {search.askPreviewDescription}
              </p>
            </div>
            {page && (
              <div className="docspot-ask-context">
                <PageSlotIcon page={page} icon={PageIcon} size={16} />
                <div>
                  <div className="docspot-ask-context-label">
                    {search.askContextLabel}
                  </div>
                  <div className="docspot-ask-context-title">
                    {page.title ?? page.url}
                  </div>
                  <div className="docspot-ask-context-hint">
                    {search.askContextHint}
                  </div>
                </div>
              </div>
            )}
            <button
              type="button"
              className="docspot-button docspot-ask-send"
              onClick={onSelect}
            >
              <SlotIcon name="send" icon={SendIcon} size={16} />
              {chat.send}
            </button>
          </div>
        ) : item.conversation?.title ? (
          <p className="docspot-ask-preview-title">{item.conversation.title}</p>
        ) : (
          <Welcome
            title={chat.welcome}
            questions={getPrompts(config.currentPage, config.prompts)}
            onChoose={question =>
              onStartChat({
                action: 'submit',
                text: question,
                source: 'prompt',
              })
            }
          />
        )}
      </div>
    </section>
  );
}
