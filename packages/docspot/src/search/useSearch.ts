import {
  type AutocompleteSource,
  type AutocompleteState,
  createAutocomplete,
} from '@algolia/autocomplete-core';
import {
  type ComponentProps,
  type SyntheticEvent,
  type KeyboardEvent,
  type MouseEvent,
  useEffect,
  useCallback,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { type ChatRequest, useDocspotInternal } from '@/core/context';
import { hasModifierKey, isCommandKey, isExternalUrl } from '@/core/platform';
import { isCommandShortcut, matchesAny } from '@/core/shortcuts';
import { addRecentPage } from '@/core/storage';
import { getSuggestions } from '@/ui/getSuggestions';
import { useScrollEdges } from '@/ui/useScrollEdges';
import type { DocspotResult } from '@/types';
import { isResult, recentItems } from '@/search/items';
import {
  type ItemSection,
  type SearchOption,
  getOptionUrl,
  groupEntries,
  highlightTerms,
  matchItems,
  normalizeResponse,
  plain,
  toStoredPage,
  type SelectOptions,
  keepsOpen,
} from '@/search/model';

const WHITESPACE = /\s+/;

/** A group of options as listed, with what its header needs. */
export type SearchGroupModel = {
  id: string;
  label: string;
  /** Results for an earlier query, shown until the current ones arrive. */
  isStale: boolean;
  /** The reader's recent pages, which can be cleared. */
  isRecent: boolean;
  source: AutocompleteState<SearchOption>['collections'][number]['source'];
  options: SearchOption[];
};

/**
 * Search's state and behavior, without its markup: the options for the
 * query, the active one, and prop getters for the parts that render them.
 */
export function useSearch() {
  const { config, search, chat } = useDocspotInternal('Docspot.SearchDialog');
  const { messages: allMessages, canChat, stores } = config;
  const messages = allMessages.search;
  const id = useId();
  const [inputElement, setInputElement] = useState<HTMLInputElement | null>(
    null
  );
  const formRef = useRef<HTMLFormElement>(null);
  const {
    ref: listRef,
    bind: bindList,
    canScrollDown,
  } = useScrollEdges<HTMLDivElement>();
  const [errorQuery, setErrorQuery] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const statusTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [state, setState] = useState<AutocompleteState<SearchOption>>({
    activeItemId: 0,
    query: search.query,
    completion: null,
    collections: [],
    context: {},
    isOpen: true,
    status: 'idle',
  });
  // Autocomplete keeps its options for its lifetime; these read the latest.
  const latest = useRef({ navigateItem, selectItem, chat, config, search });
  useLayoutEffect(() => {
    latest.current = { navigateItem, selectItem, chat, config, search };
  });
  // Stable, so result rows skip rendering when only the selection moves.
  const selectOption = useCallback(
    (item: SearchOption, options?: SelectOptions) =>
      latest.current.selectItem(item, options),
    []
  );
  const openOptionLink = useCallback(
    (url: string, event: MouseEvent<HTMLAnchorElement>) => {
      if (
        event.button !== 0 ||
        hasModifierKey(event) ||
        event.currentTarget.target === '_blank'
      )
        return;
      event.preventDefault();
      latest.current.search.leave(url, { event });
    },
    []
  );
  const abortRef = useRef<AbortController | null>(null);
  const latestSources = useRef<Promise<AutocompleteSource<SearchOption>[]>>(
    Promise.resolve([])
  );

  const [autocomplete] = useState(() =>
    createAutocomplete<SearchOption, SyntheticEvent, MouseEvent, KeyboardEvent>(
      {
        id,
        initialState: { query: search.query, isOpen: true },
        defaultActiveItemId: 0,
        openOnFocus: true,
        ignoreCompositionEvents: true,
        shouldPanelOpen: () => true,
        onStateChange: ({ state: next }) => setState(next),
        navigator: {
          navigate: ({ itemUrl, item }) =>
            latest.current.navigateItem(item, itemUrl),
        },
        getSources({ query }) {
          abortRef.current?.abort();
          const controller = new AbortController();
          abortRef.current = controller;
          const sources = loadSources(query, controller);
          latestSources.current = sources;
          return sources;
        },
      }
    )
  );

  /**
   * A request a newer query aborted resolves with the newer sources, so
   * autocomplete stays loading and keeps the previous results meanwhile.
   */
  function supersede(controller: AbortController) {
    // Closing search aborts the last request too; nothing reads it then.
    return abortRef.current === controller ? [] : latestSources.current;
  }

  async function loadSources(
    query: string,
    controller: AbortController
  ): Promise<AutocompleteSource<SearchOption>[]> {
    const { config, chat } = latest.current;
    const { messages, canChat, stores } = config;
    const toLocalUrl = (url: string) => config.toInternalUrl(url) ?? url;
    const trimmed = query.trim();
    // Older versions stored handoffs, which belong on other sites.
    const recentPages = trimmed
      ? []
      : stores.recentPages.get().filter(page => !isExternalUrl(page.url));
    let sections: ItemSection[];
    let results: DocspotResult[] = [];
    let prioritizeChat = false;
    const labels = {
      result: trimmed
        ? messages.search.documentation
        : messages.search.suggested,
      item: messages.search.actions,
    };
    if (trimmed) {
      // Items found by name come first: few, and named by what is typed.
      const matched = matchItems(config.items, trimmed, config.language);
      try {
        const { signal } = controller;
        const response = normalizeResponse(
          await (latest.current.search.takeEarlySearch(trimmed, signal) ??
            config.search!({
              query: trimmed,
              signal,
              locale: config.searchLocale,
            }))
        );
        // A search that ignores the signal may still resolve.
        if (controller.signal.aborted) return await supersede(controller);
        results = response.results;
        prioritizeChat = response.prioritizeChat;
        setErrorQuery(current => (current === trimmed ? null : current));
        config.emit({
          type: 'search.results',
          query: trimmed,
          count: results.length,
        });
      } catch (error) {
        if (controller.signal.aborted) return supersede(controller);
        setErrorQuery(trimmed);
        config.emit({ type: 'search.error', query: trimmed, error });
      }
      const seen = { urls: new Set<string>(), itemIds: new Set<string>() };
      sections = [
        ...groupEntries([...matched, ...results], labels, seen, toLocalUrl),
        // Handoffs follow the results they can link to, which keep the
        // provider's URLs for elsewhere.
        ...groupEntries(
          config.handoffs.map(handoff => handoff({ query: trimmed, results })),
          { result: labels.result, item: messages.search.handoffs },
          seen,
          toLocalUrl
        ),
      ];
    } else {
      const recentUrls = new Set(recentPages.map(page => page.url));
      const defaults = config.defaultItems;
      sections = groupEntries(
        defaults.includes(recentItems) ? defaults : [recentItems, ...defaults],
        labels,
        { urls: recentUrls, itemIds: new Set() },
        toLocalUrl
      );
    }
    const select = ({ item }: { item: SearchOption }) =>
      latest.current.selectItem(item);
    const getSourceItemUrl = ({ item }: { item: SearchOption }) =>
      getOptionUrl(item);
    const terms = trimmed.split(WHITESPACE);
    const resultSources = sections.flatMap(
      (section, index): AutocompleteSource<SearchOption>[] => {
        if (section.kind === 'recent')
          return recentPages.length
            ? [
                {
                  sourceId: 'recent',
                  getItems: () =>
                    recentPages.map((result): SearchOption => ({
                      id: `recent:${result.url}`,
                      kind: 'result',
                      result,
                      title: plain(result.title),
                      recent: true,
                      query: '',
                      sourceLabel: messages.search.recent,
                    })),
                  getItemUrl: getSourceItemUrl,
                  onSelect: select,
                },
              ]
            : [];
        return [
          {
            sourceId: `group-${index}`,
            getItems: () =>
              section.entries.map((entry): SearchOption =>
                isResult(entry)
                  ? {
                      id: `result:${entry.url}`,
                      kind: 'result',
                      result: entry,
                      title:
                        entry.highlights?.title ??
                        highlightTerms(entry.title, terms),
                      recent: false,
                      query: trimmed,
                      sourceLabel: section.label,
                    }
                  : {
                      id: `item:${entry.id}`,
                      kind: 'item',
                      item: entry,
                      title: highlightTerms(entry.title, terms),
                      query: trimmed,
                      sourceLabel: section.label,
                    }
              ),
            getItemUrl: getSourceItemUrl,
            onSelect: select,
          },
        ];
      }
    );
    if (!canChat) return resultSources;
    const conversation = trimmed ? null : chat.getActiveConversation();
    // With nothing else to list, the page's questions fill the list.
    const suggestions =
      trimmed || conversation || resultSources.length
        ? []
        : getSuggestions(config.currentPage, config.suggestions);
    const askSource: AutocompleteSource<SearchOption> = {
      sourceId: 'ask-ai',
      getItems: () =>
        suggestions.length
          ? suggestions.map((prompt): SearchOption => ({
              id: `ask-prompt:${prompt}`,
              kind: 'ask',
              title: prompt,
              prompt,
              query: '',
              sourceLabel: messages.search.askAi,
            }))
          : [
              {
                id: 'ask-ai',
                kind: 'ask',
                title: conversation
                  ? conversation.title
                  : messages.search.askAi,
                query: trimmed,
                sourceLabel:
                  trimmed && !config.slots.preview
                    ? messages.search.askAbout(trimmed)
                    : messages.search.askQuestion,
                conversation: conversation ?? undefined,
              },
            ],
      onSelect: select,
    };
    return conversation || prioritizeChat
      ? [askSource, ...resultSources]
      : [...resultSources, askSource];
  }

  const query = state.query.trim();
  // Results arrive after typing; Ask AI always offers what is typed now.
  function withLiveQuery(item: SearchOption): SearchOption {
    if (item.kind !== 'ask' || !query || item.query === query) return item;
    return {
      ...item,
      title: messages.askAi,
      query,
      sourceLabel: config.slots.preview
        ? messages.askQuestion
        : messages.askAbout(query),
      conversation: undefined,
      prompt: undefined,
    };
  }
  const items = state.collections.flatMap(collection =>
    collection.items.map(withLiveQuery)
  );
  const activeItem =
    state.activeItemId === null ? undefined : items[state.activeItemId];
  const currentItems = items.filter(item => item.query === query);
  const isListed = (item: SearchOption) => item.kind !== 'ask';
  const pageItems = currentItems.filter(isListed);
  const isLoading = state.status === 'loading' || state.status === 'stalled';
  // While loading, the previous results stay until the new ones arrive.
  const hasVisiblePages = isLoading
    ? items.some(isListed)
    : pageItems.length > 0;
  const hasError = errorQuery === query;
  const canNavigate = activeItem?.query === query;
  const inputProps = autocomplete.getInputProps({ inputElement });

  // Enter pressed before the query's results arrive chooses once they do,
  // unless the query changes first.
  const pendingEnterRef = useRef<string | null>(null);
  useEffect(() => {
    const pending = pendingEnterRef.current;
    if (pending === null) return;
    if (pending !== query) pendingEnterRef.current = null;
    else if (canNavigate) {
      pendingEnterRef.current = null;
      chooseActive();
    }
  });

  /** What Enter does: opens the active option. */
  function chooseActive() {
    if (!activeItem) return;
    selectItem(activeItem);
    const url = getOptionUrl(activeItem);
    if (url) navigateItem(activeItem, url);
  }

  useEffect(() => {
    void autocomplete.refresh();
    return () => {
      abortRef.current?.abort();
      autocomplete.setIsOpen(false);
      clearTimeout(statusTimeout.current);
    };
  }, [autocomplete]);

  // Recent pages may change in another tab while search is open.
  useEffect(
    () => stores.recentPages.subscribe(() => void autocomplete.refresh()),
    [autocomplete, stores]
  );

  const syncQuery = useEffectEvent(() => {
    if (state.query !== search.query) {
      autocomplete.setQuery(search.query);
      void autocomplete.refresh();
    }
  });
  // Only queries taken from the URL replace the input; typing owns it.
  useEffect(() => {
    syncQuery();
  }, [search.queryVersion]);

  const scrollActiveIntoView = useEffectEvent(() => {
    listRef.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  });
  useEffect(() => {
    scrollActiveIntoView();
  }, [state.activeItemId, state.collections]);

  function close() {
    search.close();
  }

  function navigateItem(item: SearchOption, url: string) {
    if (item.kind === 'ask') return;
    if (isExternalUrl(url)) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    search.leave(url, {});
  }

  function selectItem(
    selected: SearchOption,
    { keepOpen = false }: SelectOptions = {}
  ) {
    const item = withLiveQuery(selected);
    const position = items.findIndex(entry => entry.id === selected.id);
    if (item.kind === 'result') {
      const { result, query } = item;
      config.emit({ type: 'search.select', query, result, position });
      // Recent pages are this site's pages, not links elsewhere.
      if (!isExternalUrl(result.url))
        stores.recentPages.set(pages =>
          addRecentPage(pages, toStoredPage(result))
        );
    } else if (item.kind === 'item') {
      const { item: chosen, query } = item;
      config.emit({ type: 'search.select', query, item: chosen, position });
      if (typeof chosen.action === 'string') return;
      if (keepOpen) {
        chosen.action({ query });
        inputElement?.focus();
        return;
      }
      // Closed first, so what the action opens, such as a dialog, takes the focus.
      close();
      chosen.action({ query });
    } else if (item.conversation)
      openChat({ action: 'resume', conversation: item.conversation });
    else if (item.prompt)
      openChat({ action: 'submit', text: item.prompt, source: 'suggestion' });
    else
      openChat(
        item.query
          ? { action: 'submit', text: item.query, source: 'search' }
          : undefined
      );
  }

  function openChat(request?: ChatRequest) {
    // Questions from search use the page being read.
    search.openChat(
      request?.action === 'submit' || request?.action === 'draft'
        ? { ...request, page: request.page ?? config.currentPage ?? null }
        : request
    );
  }

  function askCurrentQuery() {
    if (!canChat) return;
    openChat(
      query ? { action: 'submit', text: query, source: 'search' } : undefined
    );
  }

  function reset() {
    search.setQuery('');
    autocomplete.setQuery('');
    void autocomplete.refresh();
    inputElement?.focus();
  }

  function goBack() {
    if (state.query) reset();
    else close();
  }

  function announce(text: string) {
    setStatus(text);
    clearTimeout(statusTimeout.current);
    statusTimeout.current = setTimeout(() => setStatus(null), 2000);
  }

  async function copyLink(result: DocspotResult) {
    try {
      await navigator.clipboard.writeText(config.toSiteUrl(result.url));
      announce(messages.linkCopied(result.title));
    } catch {
      // Clipboard access can be denied; the shortcut then does nothing.
    }
  }

  function onDialogKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.defaultPrevented || event.nativeEvent.isComposing) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      goBack();
      return;
    }
    // Search is for typing, so only shortcuts with ⌘ or Ctrl apply in it.
    const { shortcuts } = config;
    if (matchesAny(event, shortcuts.search.filter(isCommandShortcut))) {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) close();
      return;
    }
    if (
      canChat &&
      matchesAny(event, shortcuts.chat.filter(isCommandShortcut))
    ) {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) askCurrentQuery();
      return;
    }
    const link =
      canNavigate && activeItem.kind === 'result'
        ? activeItem.result
        : undefined;
    if (!isCommandKey(event, 'c') || event.repeat || !link) return;
    const target = event.target;
    if (
      target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    )
      return;
    // Copying selected text keeps working.
    if (
      target instanceof HTMLInputElement &&
      (target !== inputElement || target.selectionStart !== target.selectionEnd)
    )
      return;
    if (window.getSelection()?.toString()) return;
    event.preventDefault();
    event.stopPropagation();
    void copyLink(link);
  }

  const emptyHint = isLoading
    ? messages.loadingHint
    : hasError
      ? messages.errorHint
      : query
        ? canChat
          ? messages.noResultsHintWithAsk
          : messages.noResultsHint
        : undefined;
  const hasPreview = Boolean(config.slots.preview);

  /** The groups to list: current results, or the previous ones while loading. */
  const groups: SearchGroupModel[] = state.collections.flatMap(collection => {
    const firstItem = collection.items[0] && withLiveQuery(collection.items[0]);
    if (!firstItem || (!isLoading && firstItem.query !== query)) return [];
    // Suggested questions give way to asking what is typed.
    const options =
      firstItem.kind === 'ask' && collection.items[0] !== firstItem
        ? collection.items.slice(0, 1)
        : collection.items;
    return [
      {
        id: collection.source.sourceId,
        label: firstItem.sourceLabel,
        isStale: firstItem.query !== query,
        isRecent: collection.source.sourceId === 'recent',
        source: collection.source,
        options,
      },
    ];
  });

  function getFormProps(): ComponentProps<'form'> {
    return {
      ...autocomplete.getFormProps({ inputElement }),
      ref: formRef,
      onSubmit: event => {
        event.preventDefault();
        if (canNavigate) chooseActive();
      },
    };
  }

  function getInputProps(): ComponentProps<'input'> {
    return {
      ...inputProps,
      ref: setInputElement,
      placeholder: canChat ? messages.placeholderWithAsk : messages.placeholder,
      enterKeyHint:
        canNavigate &&
        activeItem.kind === 'ask' &&
        query &&
        !activeItem.conversation
          ? 'send'
          : inputProps.enterKeyHint,
      role: 'combobox',
      'aria-expanded': state.isOpen,
      'aria-autocomplete': 'list',
      'aria-busy': isLoading,
      'aria-keyshortcuts': canChat ? 'Tab' : undefined,
      'aria-activedescendant': canNavigate
        ? inputProps['aria-activedescendant']
        : undefined,
      'aria-controls': currentItems.length
        ? inputProps['aria-controls']
        : undefined,
      onFocus: () => autocomplete.setIsOpen(true),
      onChange: event => {
        inputProps.onChange(event);
        if (!(
          'isComposing' in event.nativeEvent && event.nativeEvent.isComposing
        ))
          search.setQuery(event.currentTarget.value);
      },
      onCompositionEnd: event => {
        inputProps.onCompositionEnd(event);
        search.setQuery(event.currentTarget.value);
      },
      onKeyDown: event => {
        // Safari reports keys that end a composition with keyCode 229.
        // oxlint-disable-next-line typescript/no-deprecated
        if (event.nativeEvent.isComposing || event.keyCode === 229) {
          event.stopPropagation();
          return;
        }
        if (
          canChat &&
          event.key === 'Tab' &&
          !event.shiftKey &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.altKey
        ) {
          event.preventDefault();
          askCurrentQuery();
          return;
        }
        if (event.key === 'Escape') return;
        if (
          isLoading &&
          !canNavigate &&
          (event.key === 'ArrowDown' || event.key === 'ArrowUp')
        ) {
          event.preventDefault();
          return;
        }
        // Autocomplete leaves ⌘ or Ctrl Enter to links; an action runs
        // and search stays, as for a modified click.
        if (
          event.key === 'Enter' &&
          keepsOpen(event) &&
          canNavigate &&
          activeItem.kind === 'item' &&
          typeof activeItem.item.action === 'function'
        ) {
          event.preventDefault();
          selectItem(activeItem, { keepOpen: true });
          return;
        }
        if (event.key === 'Enter' && !canNavigate) {
          event.preventDefault();
          if (!hasModifierKey(event.nativeEvent))
            pendingEnterRef.current = query;
          return;
        }
        if (
          event.key === 'Enter' &&
          activeItem?.kind === 'ask' &&
          !activeItem.conversation &&
          activeItem.query.trim()
        ) {
          event.preventDefault();
          openChat({
            action: 'submit',
            text: activeItem.query,
            source: 'search',
          });
          return;
        }
        inputProps.onKeyDown(event);
      },
    };
  }

  /** Lets autocomplete close on touch scrolling outside its panel. */
  function onTouchMove(event: TouchEvent) {
    const formElement = formRef.current;
    const panelElement = listRef.current;
    if (inputElement && formElement && panelElement)
      autocomplete
        .getEnvironmentProps({ inputElement, formElement, panelElement })
        .onTouchMove(event);
  }

  return {
    id,
    config,
    messages,
    canChat,
    hasPreview,
    rawQuery: state.query,
    query,
    status: state.status,
    isLoading,
    isLeaving: search.isLeaving,
    hasError,
    hasVisiblePages,
    resultCount: pageItems.length,
    emptyHint,
    groups,
    activeOption: activeItem,
    statusMessage: status,
    list: { ref: bindList, element: listRef, canScrollDown },
    getFormProps,
    getLabelProps: () => autocomplete.getLabelProps(),
    getInputProps,
    getListProps: (group: SearchGroupModel) =>
      autocomplete.getListProps({ source: group.source }),
    getOptionProps: (option: SearchOption, group: SearchGroupModel) =>
      autocomplete.getItemProps({ item: option, source: group.source }),
    withLiveQuery,
    selectOption,
    openOptionLink,
    openChat,
    close,
    goBack,
    announce,
    onKeyDown: onDialogKeyDown,
    onTouchMove,
    // Both buttons leave as they act, so typing goes on in the input.
    retry: () => {
      setErrorQuery(null);
      void autocomplete.refresh();
      inputElement?.focus();
    },
    clearRecent: () => {
      stores.recentPages.set([]);
      config.emit({ type: 'search.clearRecent' });
      void autocomplete.refresh();
      inputElement?.focus();
    },
  };
}

export type SearchApi = ReturnType<typeof useSearch>;
