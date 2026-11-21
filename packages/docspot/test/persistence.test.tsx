import { expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { Docspot, importDocspotHistory } from '@/index';
import { createChatServer, results } from '@test/fixtures';

const searchInput = () =>
  page.getByRole('combobox', { name: 'Search documentation' });
const recent = () => page.getByRole('region', { name: 'Recent' });

async function openSearch() {
  await page
    .getByRole('button', { name: /Search/ })
    .first()
    .click();
  await expect.element(searchInput()).toHaveFocus();
}

async function visit(title: string) {
  await openSearch();
  await userEvent.fill(searchInput(), title.toLowerCase());
  await page.getByRole('option', { name: new RegExp(title) }).click();
}

const search = ({ query }: { query: string }) =>
  results.filter(result => result.title.toLowerCase().includes(query));

it('keeps history in memory without the history prop', async () => {
  const screen = await render(<Docspot search={search} navigate={() => {}} />);
  await visit('HTTP API');
  await openSearch();
  await expect.element(recent()).toBeVisible();
  expect(localStorage.length).toBe(0);
  await screen.unmount();
  await render(<Docspot search={search} navigate={() => {}} />);
  await openSearch();
  await expect.element(recent()).not.toBeInTheDocument();
});

it('scopes persisted history by id', async () => {
  const screen = await render(
    <Docspot id="product-a" search={search} navigate={() => {}} history />
  );
  await visit('HTTP API');
  await screen.unmount();

  const other = await render(
    <Docspot id="product-b" search={search} navigate={() => {}} history />
  );
  await openSearch();
  await expect.element(recent()).not.toBeInTheDocument();
  await other.unmount();

  await render(
    <Docspot id="product-a" search={search} navigate={() => {}} history />
  );
  await openSearch();
  await expect
    .element(recent().getByRole('option', { name: /HTTP API/ }))
    .toBeVisible();
});

it('bounds recent pages to the five most recent', async () => {
  const many = Array.from({ length: 7 }, (_, index) => ({
    url: `/docs/page-${index}`,
    title: `Page ${index}`,
  }));
  await render(
    <Docspot
      search={({ query }) =>
        many.filter(item => item.title.toLowerCase() === query)
      }
      navigate={() => {}}
      history
    />
  );
  for (const item of many) await visit(item.title);
  await openSearch();
  await expect.element(recent().getByRole('option')).toHaveLength(5);
  await expect
    .element(recent().getByRole('option').first())
    .toHaveTextContent('Page 6');
});

it('ignores invalid or outdated records', async () => {
  localStorage.setItem('docspot:recent-pages', '{not json');
  localStorage.setItem(
    'docspot:conversations',
    JSON.stringify({ version: 99, value: [] })
  );
  localStorage.setItem(
    'docspot:panel',
    JSON.stringify({
      version: 1,
      value: { open: 'yes', draft: 42, width: 'wide' },
    })
  );
  const { chat } = createChatServer(() => ({ text: 'Hi.' }));
  await render(<Docspot search={search} chat={chat} history />);
  await openSearch();
  await expect
    .element(page.getByRole('option', { name: /Ask AI/ }))
    .toBeVisible();
  await expect.element(recent()).not.toBeInTheDocument();
  await expect
    .element(page.getByRole('complementary', { name: 'Ask AI' }))
    .not.toBeInTheDocument();
});

it('keeps working when storage is unavailable or full', async () => {
  const setItem = vi
    .spyOn(Storage.prototype, 'setItem')
    .mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
  await render(<Docspot search={search} navigate={() => {}} history />);
  await visit('HTTP API');
  await openSearch();
  await expect
    .element(recent().getByRole('option', { name: /HTTP API/ }))
    .toBeVisible();
  setItem.mockRestore();
});

it('refreshes when another tab changes history', async () => {
  await render(<Docspot search={search} navigate={() => {}} history />);
  await openSearch();
  await expect.element(recent()).not.toBeInTheDocument();
  const value = JSON.stringify({
    version: 1,
    value: [{ url: '/docs/elsewhere', title: 'Visited elsewhere' }],
  });
  localStorage.setItem('docspot:recent-pages', value);
  dispatchEvent(
    new StorageEvent('storage', {
      key: 'docspot:recent-pages',
      newValue: value,
    })
  );
  await expect
    .element(recent().getByRole('option', { name: /Visited elsewhere/ }))
    .toBeVisible();
});

it('imports history from a previous implementation once', async () => {
  expect(
    importDocspotHistory({
      recentPages: [{ url: '/docs/imported', title: 'Imported page' }],
      conversations: [
        {
          id: 'old',
          title: 'Imported question',
          messages: [
            {
              id: 'q',
              role: 'user',
              parts: [{ type: 'text', text: 'Imported question' }],
            },
            {
              id: 'a',
              role: 'assistant',
              parts: [{ type: 'text', text: 'Imported answer.' }],
            },
          ],
        },
      ],
      panel: { open: true, conversationId: 'old', draft: 'Imported draft' },
    })
  ).toBe(true);
  expect(
    importDocspotHistory({
      recentPages: [{ url: '/docs/other', title: 'Other' }],
    })
  ).toBe(false);

  const { chat } = createChatServer(() => ({ text: 'Hi.' }));
  await render(<Docspot search={search} chat={chat} history />);
  const panel = page.getByRole('complementary', { name: 'Ask AI' });
  await expect.element(panel.getByText('Imported answer.')).toBeVisible();
  await expect
    .element(panel.getByRole('textbox'))
    .toHaveValue('Imported draft');
  await openSearch();
  await expect
    .element(recent().getByRole('option', { name: /Imported page/ }))
    .toBeVisible();
});
