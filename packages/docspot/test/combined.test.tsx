import { Component, type ReactNode } from 'react';
import { expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import {
  Docspot,
  type DocspotPage,
  type DocspotSearch,
  useDocspot,
} from '../src';
import { createChatServer, lastQuestion, results } from './fixtures';

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
