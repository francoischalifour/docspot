import { useDocspotInternal } from '@/core/context';
import { SearchTrigger, type SearchTriggerProps } from '@/core/SearchTrigger';
import { ChatTrigger, type ChatTriggerProps } from '@/core/ChatTrigger';

/** Button props, as for `SearchTriggerProps`. */
export type TriggerProps = SearchTriggerProps & ChatTriggerProps;

/** Opens search when configured, otherwise chat. */
export function Trigger(props: TriggerProps) {
  const { config } = useDocspotInternal('Docspot.Trigger');
  return config.canSearch ? (
    <SearchTrigger {...props} />
  ) : (
    <ChatTrigger {...props} />
  );
}
