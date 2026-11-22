import { Component, type ReactNode, useEffect, useRef, useState } from 'react';
import { expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import {
  Docspot,
  type DocspotPage,
  type DocspotSearch,
  useDocspot,
} from '@/index';
import { createChatServer, lastQuestion, results } from '@test/fixtures';

const modifier = navigator.platform.includes('Mac') ? 'Meta' : 'Control';
const searchInput = () =>
  page.getByRole('combobox', { name: 'Search documentation' });
const searchDialog = () =>
  page.getByRole('dialog', { name: 'Search documentation' });
const panel = () => page.getByRole('complementary', { name: 'Ask AI' });
const answers = () => panel().getByRole('article', { name: 'Docs answer' });
const currentPage: DocspotPage = { url: '/docs/query', title: 'Query data' };

async function openSearch() {
  await page.getByRole('button', { name: 'Search or ask docs' }).click();
  await expect.element(searchInput()).toHaveFocus();
}

it('scopes shortcuts and the fixed chat inset to its owner', async () => {
  const { chat } = createChatServer(() => ({ text: 'Answer.' }));
  function ScopedDocspot() {
    const owner = useRef<HTMLDivElement>(null);
    return (
      <div ref={owner} data-testid="owner" tabIndex={-1}>
        <Docspot.Root owner={owner} search={() => results} chat={chat}>
          <Docspot.SearchTrigger />
          <Docspot.ChatTrigger />
          <Docspot.SearchDialog />
          <Docspot.ChatPanel launcher={false} />
        </Docspot.Root>
      </div>
    );
  }
  await render(<ScopedDocspot />);
  const owner = page.getByTestId('owner');
  owner.element().focus();
  await userEvent.keyboard(
    modifier === 'Meta' ? '{Meta>}k{/Meta}' : '{Control>}k{/Control}'
  );
  await expect.element(searchInput()).toHaveFocus();
  await userEvent.keyboard('{Escape}{Escape}');

  await owner.getByRole('button', { name: 'Ask AI' }).click();
  await expect.element(panel()).toBeVisible();
  expect(owner.element().getAttribute('data-docspot-chat-open')).toBe('fixed');
  expect(document.documentElement.hasAttribute('data-docspot-chat-open')).toBe(
    false
  );
});

it('routes shortcuts to the closest owner that handles them', async () => {
  function NestedOwners() {
    const outer = useRef<HTMLElement>(null);
    const inner = useRef<HTMLElement>(null);
    return (
      <>
        <button>Outside</button>
        <section ref={outer}>
          <button>Outer content</button>
          <Docspot
            owner={outer}
            search={() => []}
            messages={{ search: { title: 'Outer search' } }}
          />
          <section ref={inner}>
            <button>Inner content</button>
            <Docspot
              owner={inner}
              search={() => []}
              messages={{ search: { title: 'Inner search' } }}
            />
          </section>
        </section>
      </>
    );
  }
  await render(<NestedOwners />);
  await page.getByRole('button', { name: 'Outside' }).click();
  await userEvent.keyboard('/');
  await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
  await page.getByRole('button', { name: 'Inner content' }).click();
  await userEvent.keyboard('/');
  await expect
    .element(page.getByRole('dialog', { name: 'Inner search' }))
    .toBeVisible();
  await userEvent.keyboard('{Escape}');
  await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
  await page.getByRole('button', { name: 'Outer content' }).click();
  await userEvent.keyboard('/');
  await expect
    .element(page.getByRole('dialog', { name: 'Outer search' }))
    .toBeVisible();
});

it('uses the messages written for asking when chat is available', async () => {
  const { chat } = createChatServer(() => ({ text: 'Answer.' }));
  await render(
    <Docspot
      search={() => []}
      chat={chat}
      messages={{
        search: {
          placeholder: 'Find a page…',
          placeholderWithAsk: 'Find a page or ask…',
        },
      }}
    />
  );
  await openSearch();
  await expect
    .element(searchInput())
    .toHaveAttribute('placeholder', 'Find a page or ask…');
});

it('hands the query to chat with Tab, with the page being read attached', async () => {
  const { chat, requests } = createChatServer(question => ({
    text: `About ${question}.`,
  }));
  await render(
    <Docspot
      search={() => results}
      chat={chat}
      context={{ page: currentPage }}
    />
  );
  await openSearch();
  await userEvent.keyboard('how do I join tables{Tab}');
  await expect.element(searchDialog()).not.toBeInTheDocument();
  await expect
    .element(answers().getByText('About how do I join tables.'))
    .toBeVisible();
  expect(requests[0]?.body.docspot?.page).toMatchObject({
    url: `${location.origin}/docs/query`,
  });

  // Search opened from chat returns to the composer when closed.
  await userEvent.keyboard(`{${modifier}>}k{/${modifier}}`);
  await expect.element(searchInput()).toHaveFocus();
  await userEvent.keyboard('{Escape}');
  await expect.element(panel().getByRole('textbox')).toHaveFocus();

  // With an active conversation, search offers to continue it first.
  await userEvent.keyboard(`{${modifier}>}k{/${modifier}}`);
  const first = page.getByRole('option').first();
  await expect.element(first).toHaveTextContent(/how do I join tables/);
  await expect.element(first).toHaveTextContent(/Continue chat/);
});

it('sends the search query from the Ask AI preview with the current page', async () => {
  const { chat, requests } = createChatServer(question => ({
    text: `About ${question}.`,
  }));
  await render(
    <Docspot
      search={() => results}
      chat={chat}
      context={{ page: currentPage }}
      slots={{ preview: ({ result }) => <p>Preview of {result.title}</p> }}
    />
  );
  // The default layout has no floating launcher beside the search trigger.
  await expect
    .element(page.getByRole('button', { name: 'Ask AI' }))
    .not.toBeInTheDocument();
  await openSearch();
  await expect
    .element(searchDialog().getByRole('button', { name: /Ask AI/ }))
    .not.toBeInTheDocument();

  await userEvent.keyboard('how do I join tables?');
  const ask = page.getByRole('option', { name: /Ask AI/ });
  await ask.hover();
  const preview = page.getByRole('region', { name: 'Ask AI' });
  await expect.element(preview.getByText('Current page')).toBeVisible();
  await expect.element(preview.getByText('Query data')).toBeVisible();
  expect(
    searchDialog().element().querySelectorAll('input, textarea')
  ).toHaveLength(1);

  await preview.getByRole('button', { name: 'Send question' }).click();
  await expect
    .element(answers().getByText('About how do I join tables?.'))
    .toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0]?.body.docspot?.page).toMatchObject({
    url: `${location.origin}/docs/query`,
  });
});

it('leads with Ask AI only when the search response prioritizes chat', async () => {
  const { chat } = createChatServer(() => ({ text: 'Answer.' }));
  const search: DocspotSearch = ({ query }) => ({
    results,
    prioritizeChat: query.endsWith('?'),
  });
  await render(<Docspot search={search} chat={chat} />);
  await openSearch();
  await userEvent.keyboard('sql');
  await expect
    .element(page.getByRole('option').first())
    .toHaveTextContent(/Example/);
  await expect
    .element(page.getByRole('option').last())
    .toHaveTextContent(/Ask AI/);
  await userEvent.keyboard(' explorer?');
  await expect
    .element(page.getByRole('option').first())
    .toHaveTextContent(/“sql explorer\?”/);
  await userEvent.keyboard('{Enter}');
  await expect.element(answers().getByText('Answer.')).toBeVisible();
});

it('offers only search controls and shortcuts without chat', async () => {
  await render(<Docspot search={() => results} />);
  await page.getByRole('button', { name: 'Search docs' }).click();
  await expect.element(searchInput()).toHaveFocus();
  await expect
    .element(page.getByRole('button', { name: 'Ask AI' }))
    .not.toBeInTheDocument();
  await userEvent.keyboard('sql{Tab}');
  await expect.element(searchDialog()).toBeVisible();
  await expect
    .element(page.getByRole('option', { name: /Ask AI/ }))
    .not.toBeInTheDocument();
  await userEvent.keyboard('{Escape}{Escape}');
  await userEvent.keyboard(`{${modifier}>}j{/${modifier}}`);
  await expect.element(panel()).not.toBeInTheDocument();
});

it('rejects a configuration without search or chat', async () => {
  class Boundary extends Component<{ children: ReactNode }, { error?: Error }> {
    override state: { error?: Error } = {};
    static getDerivedStateFromError(error: Error) {
      return { error };
    }
    override render() {
      return this.state.error ? (
        <p>{this.state.error.message}</p>
      ) : (
        this.props.children
      );
    }
  }
  const onError = (event: ErrorEvent) => event.preventDefault();
  addEventListener('error', onError);
  await render(
    <Boundary>
      {/* @ts-expect-error At least one capability is required. */}
      <Docspot />
    </Boundary>
  );
  removeEventListener('error', onError);
  await expect
    .element(page.getByText('Docspot: configure `search`, `chat`, or both.'))
    .toBeVisible();
});

it('syncs the query with the URL, keeps other parameters, and follows history', async () => {
  history.replaceState(null, '', '/docs?tab=react');
  await render(<Docspot search={() => results} syncUrl />);
  await page.getByRole('button', { name: 'Search docs' }).click();
  await expect.element(searchInput()).toHaveFocus();
  expect(location.search).toBe('?tab=react&q=');
  await userEvent.keyboard('sql');
  await expect.poll(() => location.search).toBe('?tab=react&q=sql');

  history.back();
  await expect.element(searchDialog()).not.toBeInTheDocument();
  expect(location.search).toBe('?tab=react');
  history.forward();
  await expect.element(searchInput()).toHaveValue('sql');
  await userEvent.keyboard('{Escape}{Escape}');
  await expect.poll(() => location.search).toBe('?tab=react');
});

it('opens search from a link', async () => {
  history.replaceState(null, '', '/docs?q=http');
  await render(<Docspot search={() => results} syncUrl />);
  await expect.element(searchInput()).toHaveValue('http');
  await expect
    .element(page.getByRole('option', { name: /HTTP API/ }))
    .toBeVisible();
});

it('keeps browser navigation from being overwritten by a pending query write', async () => {
  history.replaceState(null, '', '/docs?q=earlier');
  await render(<Docspot search={() => results} syncUrl />);
  await expect.element(searchInput()).toHaveValue('earlier');
  await userEvent.keyboard(' later');

  history.replaceState(null, '', '/docs?q=history');
  dispatchEvent(new PopStateEvent('popstate'));
  await expect.element(searchInput()).toHaveValue('history');
  await new Promise(resolve => setTimeout(resolve, 350));
  expect(location.search).toBe('?q=history');
});

it('composes surfaces and controls them with useDocspot', async () => {
  const { chat, requests } = createChatServer(question => ({
    text: `About ${question}.`,
  }));
  function Controls() {
    const docspot = useDocspot();
    return (
      <>
        <button type="button" onClick={() => docspot.openSearch('http')}>
          Find HTTP
        </button>
        <button
          type="button"
          onClick={() => docspot.setDraft('Draft text', { page: null })}
        >
          Draft
        </button>
        <button type="button" onClick={() => docspot.startConversation()}>
          Fresh
        </button>
        <output>{docspot.isChatOpen ? 'chat open' : 'chat closed'}</output>
      </>
    );
  }
  await render(
    <Docspot.Root
      search={() => results}
      chat={chat}
      context={{ page: currentPage }}
    >
      <Docspot.SearchTrigger />
      <Controls />
      <Docspot.SearchDialog />
      <Docspot.ChatPanel launcher={false} />
    </Docspot.Root>
  );
  await page.getByRole('button', { name: 'Find HTTP' }).click();
  await expect.element(searchInput()).toHaveValue('http');
  await userEvent.keyboard('{Escape}{Escape}');

  await page.getByRole('button', { name: 'Draft' }).click();
  await expect.element(panel().getByRole('textbox')).toHaveValue('Draft text');
  await expect.element(page.getByText('chat open')).toBeVisible();
  await expect
    .element(panel().getByText('Page context:'))
    .not.toBeInTheDocument();
  await userEvent.keyboard('{Enter}');
  await expect.element(answers().getByText('About Draft text.')).toBeVisible();
  expect(requests[0]?.body.docspot?.page).toBeUndefined();
  expect(lastQuestion(requests[0])).toBe('Draft text');

  await page.getByRole('button', { name: 'Fresh' }).click();
  await expect
    .element(panel().getByRole('heading', { name: 'Ask AI about these docs' }))
    .toBeVisible();
});

it('reopens search with its query when going back from a result', async () => {
  history.replaceState(null, '', '/docs');
  await render(
    <Docspot
      search={() => results}
      syncUrl
      navigate={url => history.pushState(null, '', url)}
    />
  );
  await page.getByRole('button', { name: 'Search docs' }).click();
  await expect.element(searchInput()).toHaveFocus();
  await userEvent.keyboard('http');
  await page.getByRole('option', { name: /HTTP API/ }).click();
  expect(location.pathname).toBe('/docs/query/http-api');
  await expect.element(searchDialog()).not.toBeInTheDocument();
  history.back();
  await expect.element(searchInput()).toHaveValue('http');
  expect(location.search).toBe('?q=http');
});

it('keeps useDocspot methods stable across renders', async () => {
  const { chat } = createChatServer(() => ({ text: 'Answer.' }));
  const seen = new Set<unknown>();
  function Probe() {
    const docspot = useDocspot();
    const { openSearch } = docspot;
    seen.add(openSearch);
    useEffect(() => {
      // An effect that depends on a method runs once, not on every render.
      seen.add('effect');
    }, [openSearch]);
    return (
      <button type="button" onClick={() => docspot.openChat()}>
        {docspot.isChatOpen ? 'Opened' : 'Open'}
      </button>
    );
  }
  await render(
    <Docspot.Root search={() => results} chat={chat}>
      <Probe />
      <Docspot.SearchDialog />
      <Docspot.ChatPanel launcher={false} />
    </Docspot.Root>
  );
  await page.getByRole('button', { name: 'Open' }).click();
  await expect
    .element(page.getByRole('button', { name: 'Opened' }))
    .toBeVisible();
  expect([...seen]).toHaveLength(2);
});

it('lets a parent control whether search is open and its query', async () => {
  const events: string[] = [];
  const onSearchOpenChange = vi.fn();
  function Page() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    return (
      <>
        <button
          type="button"
          onClick={() => {
            setQuery('http');
            setOpen(true);
          }}
        >
          Find HTTP
        </button>
        <output>{`${open ? 'open' : 'closed'}: ${query}`}</output>
        <Docspot
          search={() => results}
          searchOpen={open}
          onSearchOpenChange={next => {
            onSearchOpenChange(next);
            setOpen(next);
          }}
          query={query}
          onQueryChange={setQuery}
          onEvent={event => events.push(event.type)}
        />
      </>
    );
  }
  await render(<Page />);
  await page.getByRole('button', { name: 'Find HTTP' }).click();
  await expect.element(searchInput()).toHaveValue('http');
  await expect.element(searchInput()).toHaveFocus();
  await userEvent.keyboard(' api');
  await expect.element(page.getByText('open: http api')).toBeInTheDocument();

  await userEvent.keyboard('{Escape}');
  await expect.element(searchInput()).toHaveValue('');
  await userEvent.keyboard('{Escape}');
  expect(onSearchOpenChange).toHaveBeenLastCalledWith(false);
  await expect.element(searchDialog()).not.toBeInTheDocument();
  await expect
    .element(page.getByRole('button', { name: 'Find HTTP' }))
    .toHaveFocus();
  expect(
    events.filter(
      type => type.startsWith('search.o') || type === 'search.close'
    )
  ).toEqual(['search.open', 'search.close']);
});

it('only asks to open search when a parent keeps it closed', async () => {
  const onSearchOpenChange = vi.fn();
  await render(
    <Docspot
      search={() => results}
      searchOpen={false}
      onSearchOpenChange={onSearchOpenChange}
    />
  );
  await page.getByRole('button', { name: 'Search docs' }).click();
  expect(onSearchOpenChange).toHaveBeenCalledWith(true);
  await expect.element(searchDialog()).not.toBeInTheDocument();
});

it('sends a question once a parent controlling chat opens it', async () => {
  const { chat, requests } = createChatServer(question => ({
    text: `About ${question}.`,
  }));
  const onChatOpenChange = vi.fn();
  function Page() {
    const [chatOpen, setChatOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setChatOpen(true)}>
          Allow chat
        </button>
        <Docspot
          search={() => results}
          chat={chat}
          chatOpen={chatOpen}
          onChatOpenChange={next => {
            onChatOpenChange(next);
            if (!next) setChatOpen(false);
          }}
        />
      </>
    );
  }
  await render(<Page />);
  await openSearch();
  await userEvent.keyboard('How do I query?{Tab}');
  expect(onChatOpenChange).toHaveBeenLastCalledWith(true);
  // The panel loads on demand, so it may not exist yet.
  expect(panel().query()?.checkVisibility() ?? false).toBe(false);
  expect(requests).toHaveLength(0);

  await page.getByRole('button', { name: 'Allow chat' }).click();
  await expect
    .element(answers().getByText('About How do I query?.'))
    .toBeVisible();

  await panel().getByRole('button', { name: 'Hide Ask AI' }).click();
  expect(onChatOpenChange).toHaveBeenLastCalledWith(false);
  await expect
    .element(page.getByRole('button', { name: 'Hide Ask AI' }))
    .not.toBeInTheDocument();
});
