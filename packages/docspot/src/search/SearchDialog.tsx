import {
  type AutocompleteSource,
  type AutocompleteState,
  createAutocomplete,
} from '@algolia/autocomplete-core';
import {
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { type ChatRequest, useDocspotInternal } from '@/core/Root';
import {
  hasModifierKey,
  isCommandKey,
  isExternalUrl,
  useVisualViewport,
} from '@/core/platform';
import { addRecentPage } from '@/core/storage';
import { LoadingIcon, SearchIcon } from '@/ui/icons';
import { Kbd, cx } from '@/ui/primitives';
import { getPrompts } from '@/ui/Suggestions';
import { useScrollEdges } from '@/ui/useScrollEdges';
import { PreviewPanel } from '@/search/PreviewPanel';
import { ResultItem } from '@/search/ResultItem';
import type { DocspotItem, DocspotLinkItem } from '@/types';
import { getItemId, isLinkItem, recentItems } from '@/search/items';
import {
  type ItemSection,
  type SearchItem,
  fromStoredPage,
  getItemUrl,
  groupItems,
  highlightTerms,
  matchItems,
  normalizeResponse,
  plain,
  toStoredPage,
} from '@/search/model';

export function SearchDialog() {
  const { config, search, chat } = useDocspotInternal('Docspot.SearchDialog');
  const { messages: allMessages, canChat, stores } = config;
  const messages = allMessages.search;
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [dialog, setDialog] = useState<HTMLDialogElement | null>(null);
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
  useVisualViewport(dialog);

  const [state, setState] = useState<AutocompleteState<SearchItem>>({
    activeItemId: 0,
    query: search.query,
    completion: null,
    collections: [],
    context: {},
    isOpen: true,
    status: 'idle',
  });
  // Autocomplete keeps its options for its lifetime; these read the latest.
  const latest = useRef({ navigateItem, selectItem, chat, config });
  useLayoutEffect(() => {
    latest.current = { navigateItem, selectItem, chat, config };
  });
  const abortRef = useRef<AbortController | null>(null);
  const latestSources = useRef<Promise<AutocompleteSource<SearchItem>[]>>(
    Promise.resolve([])
  );

  const [autocomplete] = useState(() =>
    createAutocomplete<SearchItem, FormEvent, MouseEvent, KeyboardEvent>({
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
    })
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
  ): Promise<AutocompleteSource<SearchItem>[]> {
    const { config, chat } = latest.current;
    const { messages, canChat, stores } = config;
    const trimmed = query.trim();
    // Older versions stored handoffs, which belong on other sites.
    const recentPages = trimmed
      ? []
      : stores.recentPages.get().filter(page => !isExternalUrl(page.url));
    let sections: ItemSection[];
    let results: DocspotItem[] = [];
    let prioritizeChat = false;
    const labels = {
      page: trimmed ? messages.search.documentation : messages.search.suggested,
      action: messages.search.actions,
    };
    if (trimmed) {
      // Items found by name come first: few, and named by what is typed.
      const matched = matchItems(config.items, trimmed);
      try {
        const response = normalizeResponse(
          await config.search!({
            query: trimmed,
            signal: controller.signal,
          })
        );
        // A search that ignores the signal may still resolve.
        if (controller.signal.aborted) return supersede(controller);
        results = response.items;
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
      sections = groupItems([...matched, ...results], labels);
    } else {
      const recentUrls = new Set(recentPages.map(page => page.url));
      const defaults = config.defaultItems.filter(
        item =>
          item === recentItems ||
          !isLinkItem(item) ||
          !recentUrls.has(item.action)
      );
      sections = groupItems(
        defaults.includes(recentItems) ? defaults : [recentItems, ...defaults],
        labels
      );
    }
    const select = ({ item }: { item: SearchItem }) =>
      latest.current.selectItem(item);
    const getSourceItemUrl = ({ item }: { item: SearchItem }) =>
      getItemUrl(item);
    // Matches in local items are marked here; providers mark their own.
    const terms = trimmed.split(/\s+/);
    const resultSources: AutocompleteSource<SearchItem>[] = [
      ...sections.flatMap(
        (section, index): AutocompleteSource<SearchItem>[] => {
          if (section.kind === 'recent')
            return recentPages.length
              ? [
                  {
                    sourceId: 'recent',
                    getItems: () =>
                      recentPages.map((page): SearchItem => {
                        const item = fromStoredPage(page);
                        return {
                          id: `recent:${page.url}`,
                          kind: 'item',
                          item,
                          title: plain(item.title),
                          recent: true,
                          query: '',
                          sourceLabel: messages.search.recent,
                        };
                      }),
                    getItemUrl: getSourceItemUrl,
                    onSelect: select,
                  },
                ]
              : [];
          return [
            {
              sourceId: `group-${index}`,
              getItems: () =>
                section.items.map((item): SearchItem => ({
                  id: getItemId(item),
                  kind: 'item',
                  item,
                  title:
                    item.highlights?.title ??
                    (trimmed && !results.includes(item)
                      ? highlightTerms(item.title, terms)
                      : plain(item.title)),
                  recent: false,
                  query: trimmed,
                  sourceLabel: section.label,
                })),
              getItemUrl: getSourceItemUrl,
              onSelect: select,
            },
          ];
        }
      ),
      ...(trimmed && config.handoffs.length
        ? [
            {
              sourceId: 'handoffs',
              getItems: () =>
                config.handoffs.map((handoff): SearchItem => ({
                  id: `handoff:${handoff.id}`,
                  kind: 'handoff',
                  handoff,
                  url: handoff.getUrl(trimmed, { items: results }),
                  query: trimmed,
                  sourceLabel: messages.search.handoffs,
                })),
              getItemUrl: getSourceItemUrl,
              onSelect: select,
            },
          ]
        : []),
    ];
    if (!canChat) return resultSources;
    const conversation = trimmed ? null : chat.getActiveConversation();
    // With nothing else to list, the page's questions fill the list.
    const prompts =
      trimmed || conversation || resultSources.length
        ? []
        : getPrompts(config.currentPage, config.prompts);
    const askSource: AutocompleteSource<SearchItem> = {
      sourceId: 'ask-ai',
      getItems: () =>
        prompts.length
          ? prompts.map((prompt): SearchItem => ({
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
                sourceLabel: trimmed
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
  function withLiveQuery(item: SearchItem): SearchItem {
    if (item.kind !== 'ask' || !query || item.query === query) return item;
    return {
      ...item,
      title: messages.askAi,
      query,
      sourceLabel: messages.askAbout(query),
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
  const isListed = (item: SearchItem) => item.kind === 'item';
  const pageItems = currentItems.filter(isListed);
  const isLoading = state.status === 'loading' || state.status === 'stalled';
  // While loading, the previous results stay until the new ones arrive.
  const hasVisiblePages = isLoading
    ? items.some(isListed)
    : pageItems.length > 0;
  const hasError = errorQuery === query;
  const canNavigate = activeItem?.query === query;
  const inputProps = autocomplete.getInputProps({ inputElement });

  useEffect(() => {
    dialogRef.current?.showModal();
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

  function navigateItem(item: SearchItem, url: string) {
    if (item.kind === 'ask') return;
    if (item.kind === 'handoff' || isExternalUrl(url)) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    search.leave();
    config.navigate(url, {});
  }

  function selectItem(selected: SearchItem) {
    const item = withLiveQuery(selected);
    if (item.kind === 'item') {
      const { item: chosen } = item;
      config.emit({
        type: 'search.select',
        query: item.query,
        item: chosen,
        position: items.findIndex(entry => entry.id === selected.id),
      });
      if (isLinkItem(chosen)) {
        // Recent pages are this site's pages, not links elsewhere.
        if (!isExternalUrl(chosen.action))
          stores.recentPages.set(pages =>
            addRecentPage(pages, toStoredPage(chosen))
          );
        return;
      }
      // Closed first, so what the action opens, such as a dialog, takes the focus.
      close();
      chosen.action({ query: item.query });
    } else if (item.kind === 'handoff')
      config.emit({
        type: 'search.handoff',
        query: item.query,
        handoff: item.handoff.id,
        url: item.url,
      });
    else if (item.conversation)
      openChat({ action: 'resume', conversation: item.conversation });
    else if (item.prompt)
      openChat({ action: 'submit', text: item.prompt, source: 'prompt' });
    else
      openChat(
        item.query
          ? { action: 'submit', text: item.query, source: 'search' }
          : undefined
      );
  }

  function openChat(request?: ChatRequest) {
    // Questions from search use the page being read.
    search.ask(
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

  async function copyLink(link: DocspotLinkItem) {
    try {
      await navigator.clipboard.writeText(config.toSiteUrl(link.action));
      announce(messages.linkCopied(link.title));
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
    if (isCommandKey(event, 'k')) {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) close();
      return;
    }
    if (canChat && isCommandKey(event, 'j')) {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) askCurrentQuery();
      return;
    }
    const link =
      canNavigate && activeItem.kind === 'item' && isLinkItem(activeItem.item)
        ? activeItem.item
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

  const BrandingSlot = config.slots.branding;
  // Without a preview slot, results take the whole dialog.
  const hasPreview = Boolean(config.slots.preview);

  return (
    <dialog
      ref={element => {
        dialogRef.current = element;
        setDialog(element);
      }}
      data-docspot-search=""
      data-preview={hasPreview || undefined}
      className="docspot-search"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      onCancel={event => {
        event.preventDefault();
        goBack();
      }}
      onClick={event => {
        if (event.target === event.currentTarget) close();
      }}
      onKeyDown={onDialogKeyDown}
      onTouchMove={event => {
        const formElement = formRef.current;
        const panelElement = listRef.current;
        if (inputElement && formElement && panelElement)
          autocomplete
            .getEnvironmentProps({ inputElement, formElement, panelElement })
            .onTouchMove(event.nativeEvent);
      }}
    >
      <div className="docspot-search-body">
        <h2 id={`${id}-title`} className="docspot-sr-only">
          {messages.title}
        </h2>
        <p id={`${id}-description`} className="docspot-sr-only">
          {canChat ? messages.descriptionWithAsk : messages.description}
        </p>
        <div className="docspot-search-header">
          <form
            {...autocomplete.getFormProps({ inputElement })}
            ref={formRef}
            className="docspot-search-form"
            onSubmit={event => {
              event.preventDefault();
              if (!canNavigate) return;
              selectItem(activeItem);
              const url = getItemUrl(activeItem);
              if (url) navigateItem(activeItem, url);
            }}
          >
            <label
              {...autocomplete.getLabelProps()}
              className="docspot-sr-only"
            >
              {messages.title}
            </label>
            {state.status === 'stalled' ? (
              <LoadingIcon size={20} className="docspot-spin docspot-muted" />
            ) : (
              <SearchIcon size={20} className="docspot-muted" />
            )}
            <input
              {...inputProps}
              ref={setInputElement}
              autoFocus
              className="docspot-search-input"
              placeholder={
                canChat ? messages.placeholderWithAsk : messages.placeholder
              }
              enterKeyHint={
                canNavigate &&
                activeItem.kind === 'ask' &&
                query &&
                !activeItem.conversation
                  ? 'send'
                  : inputProps.enterKeyHint
              }
              role="combobox"
              aria-expanded={state.isOpen}
              aria-autocomplete="list"
              aria-busy={isLoading}
              aria-keyshortcuts={canChat ? 'Tab' : undefined}
              aria-activedescendant={
                canNavigate ? inputProps['aria-activedescendant'] : undefined
              }
              aria-controls={
                currentItems.length ? inputProps['aria-controls'] : undefined
              }
              onFocus={() => autocomplete.setIsOpen(true)}
              onChange={event => {
                inputProps.onChange(event);
                if (
                  !(
                    'isComposing' in event.nativeEvent &&
                    event.nativeEvent.isComposing
                  )
                )
                  search.setQuery(event.currentTarget.value);
              }}
              onCompositionEnd={event => {
                inputProps.onCompositionEnd(event);
                search.setQuery(event.currentTarget.value);
              }}
              onKeyDown={event => {
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
                if (event.key === 'Enter' && !canNavigate) {
                  event.preventDefault();
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
              }}
            />
          </form>
          <button
            type="button"
            className="docspot-header-action"
            onClick={close}
          >
            {messages.close}
          </button>
        </div>
        <div className="docspot-search-main">
          <div className="docspot-search-results">
            <div
              ref={bindList}
              className={cx(
                'docspot-search-list',
                canScrollDown && 'docspot-fade-bottom',
                state.status === 'stalled' && 'docspot-stalled'
              )}
              aria-busy={isLoading}
            >
              {!hasVisiblePages && (
                <div className="docspot-search-empty">
                  <SearchIcon size={20} className="docspot-subtle" />
                  <p className="docspot-search-empty-title">
                    {isLoading
                      ? messages.loading
                      : hasError
                        ? messages.error
                        : query
                          ? messages.noResults(state.query)
                          : messages.emptyTitle}
                  </p>
                  {(hasError || isLoading || query) && (
                    <p className="docspot-search-empty-hint">
                      {hasError
                        ? messages.errorHint
                        : isLoading
                          ? messages.loadingHint
                          : canChat
                            ? messages.noResultsHintWithAsk
                            : messages.noResultsHint}
                    </p>
                  )}
                  {hasError && (
                    <button
                      type="button"
                      className="docspot-button"
                      onClick={() => {
                        setErrorQuery(null);
                        void autocomplete.refresh();
                      }}
                    >
                      {messages.retry}
                    </button>
                  )}
                </div>
              )}
              {state.collections.map(collection => {
                const firstItem =
                  collection.items[0] && withLiveQuery(collection.items[0]);
                if (!firstItem || (!isLoading && firstItem.query !== query))
                  return null;
                const isStale = firstItem.query !== query;
                const label = firstItem.sourceLabel;
                // Suggested questions give way to asking what is typed.
                const sourceItems =
                  firstItem.kind === 'ask' && collection.items[0] !== firstItem
                    ? collection.items.slice(0, 1)
                    : collection.items;
                return (
                  <section
                    key={collection.source.sourceId}
                    aria-label={label}
                    className="docspot-search-group"
                    inert={isStale}
                    aria-hidden={isStale || undefined}
                  >
                    <div className="docspot-search-group-header">
                      <h3 className="docspot-truncate" title={label}>
                        {label}
                      </h3>
                      {collection.source.sourceId === 'recent' && (
                        <button
                          type="button"
                          className="docspot-text-button"
                          onClick={() => {
                            stores.recentPages.set([]);
                            config.emit({ type: 'history.clear' });
                            void autocomplete.refresh();
                          }}
                        >
                          {messages.clearHistory}
                        </button>
                      )}
                    </div>
                    <ul
                      {...autocomplete.getListProps({
                        source: collection.source,
                      })}
                    >
                      {sourceItems.map(item => (
                        <ResultItem
                          key={item.id}
                          item={withLiveQuery(item)}
                          itemProps={autocomplete.getItemProps({
                            item,
                            source: collection.source,
                          })}
                          // Asking and actions do not wait for pending results.
                          onSelect={() => selectItem(item)}
                          onNavigate={(url, event) => {
                            if (
                              event.button !== 0 ||
                              hasModifierKey(event) ||
                              event.currentTarget.target === '_blank'
                            )
                              return;
                            event.preventDefault();
                            search.leave();
                            config.navigate(url, { event });
                          }}
                        />
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          </div>
          {hasPreview && (
            <PreviewPanel
              activeItem={activeItem}
              query={query}
              isLoading={isLoading}
              onClose={close}
              onLeave={search.leave}
              onNotify={announce}
              onStartChat={openChat}
              onHandoff={selectItem}
              onRun={selectItem}
            />
          )}
        </div>
        <footer className="docspot-search-footer">
          <div
            data-docspot-hints=""
            aria-hidden="true"
            className="docspot-hints"
          >
            <span>
              <Kbd keys={['esc']} />{' '}
              {state.query ? messages.toClear : messages.toClose}
            </span>
            <span>
              <span className="docspot-kbd-pair">
                <Kbd keys={['up']} />
                <Kbd keys={['down']} />
              </span>
              {messages.toNavigate}
            </span>
            <span>
              <Kbd keys={['enter']} /> {messages.toOpen}
            </span>
          </div>
          <span
            className="docspot-sr-only"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {isLoading
              ? messages.searching
              : hasError
                ? messages.unavailable
                : query
                  ? messages.resultCount(pageItems.length)
                  : messages.title}
          </span>
          {status && (
            <span className="docspot-toast" role="status">
              {status}
            </span>
          )}
          {BrandingSlot && (
            <div className="docspot-branding">
              <BrandingSlot />
            </div>
          )}
        </footer>
      </div>
    </dialog>
  );
}

export default SearchDialog;
