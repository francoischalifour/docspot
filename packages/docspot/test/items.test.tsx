import { expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import {
  Docspot,
  type DocspotEvent,
  type DocspotItem,
  type DocspotResult,
  defineItem,
  recentItems,
} from '@/index';
import { results } from '@test/fixtures';

const modifier = navigator.platform.includes('Mac') ? 'Meta' : 'Control';
const searchInput = () =>
  page.getByRole('combobox', { name: 'Search documentation' });
const searchDialog = () =>
  page.getByRole('dialog', { name: 'Search documentation' });
const actions = () => page.getByRole('region', { name: 'Actions' });

async function openSearch() {
  await page.getByRole('button', { name: 'Search docs' }).click();
  await expect.element(searchInput()).toHaveFocus();
}

const search = ({ query }: { query: string }) =>
  results.filter(result => result.title.toLowerCase().includes(query));
const regions = () =>
  page
    .getByRole('region')
    .elements()
    .map(region => region.getAttribute('aria-label'));

async function visit(query: string) {
  await openSearch();
  await userEvent.keyboard(`${query}{Enter}`);
  await expect.element(searchDialog()).not.toBeInTheDocument();
}

function commands() {
  const runs = { theme: vi.fn(), save: vi.fn(), map: vi.fn() };
  const list: DocspotItem[] = [
    {
      id: 'theme',
      title: 'Thème sombre',
      keywords: ['dark theme'],
      action: runs.theme,
    },
    {
      id: 'save',
      title: 'Save the tree',
      shortcut: 'Meta+S',
      description: 'Downloads the tree as a file.',
      action: runs.save,
    },
    { id: 'map', title: 'Map', group: 'Go to', action: runs.map },
  ];
  return { list, runs };
}

it('lists the actions the query names, in their own group before the results, and runs one with Enter', async () => {
  const { list, runs } = commands();
  const events: DocspotEvent[] = [];
  await render(
    <Docspot
      search={search}
      items={list}
      navigate={() => {}}
      onEvent={event => events.push(event)}
    />
  );
  await openSearch();
  // Nothing typed, nothing to do: the default results stay as they are.
  await expect.element(actions()).not.toBeInTheDocument();

  // Accents and case don't matter, and every word must start a word of its title or keywords.
  await userEvent.keyboard('theme');
  await expect
    .element(actions().getByRole('option', { name: /Thème sombre/ }))
    .toBeVisible();
  await expect.element(actions().getByRole('option')).toHaveLength(1);
  await userEvent.fill(searchInput(), 'dark');
  await expect
    .element(actions().getByRole('option', { name: /Thème sombre/ }))
    .toBeVisible();
  await userEvent.fill(searchInput(), 'dark light');
  await expect.element(actions()).not.toBeInTheDocument();

  // Apart from the pages, and before them.
  await userEvent.fill(searchInput(), 't');
  await expect
    .element(page.getByRole('option', { name: /HTTP API/ }))
    .toBeVisible();
  await expect.poll(regions).toEqual(['Actions', 'Lakehouse', 'Agents']);

  await userEvent.fill(searchInput(), 'theme');
  await expect
    .element(actions().getByRole('option').first())
    .toHaveAttribute('aria-selected', 'true');
  await userEvent.keyboard('{Enter}');
  expect(runs.theme).toHaveBeenCalledWith({ query: 'theme' });
  await expect.element(searchDialog()).not.toBeInTheDocument();
  expect(events).toContainEqual({
    type: 'search.select',
    query: 'theme',
    item: list[0],
    position: 0,
  });
});

it('runs an action on click, with actions its only matches, in a group of its own', async () => {
  const { list, runs } = commands();
  await render(<Docspot search={search} items={list} />);
  await openSearch();
  await userEvent.keyboard('map');
  const goTo = page.getByRole('region', { name: 'Go to' });
  // No page matches, yet nothing says there are no results.
  await expect.element(goTo.getByRole('option', { name: 'Map' })).toBeVisible();
  await expect
    .element(page.getByText('No results for “map”'))
    .not.toBeInTheDocument();
  await goTo.getByRole('option', { name: 'Map' }).click();
  expect(runs.map).toHaveBeenCalledOnce();
  await expect.element(searchDialog()).not.toBeInTheDocument();
});

it('runs an action and keeps search open with its query, with the modifier key', async () => {
  const { list, runs } = commands();
  await render(
    <Docspot
      search={search}
      items={list}
      slots={{ preview: () => <p>Page preview</p> }}
    />
  );
  await openSearch();
  await userEvent.keyboard('map');
  const map = page.getByRole('option', { name: 'Map' });
  await expect.element(map).toBeVisible();

  // As a link opens in a new tab: the action runs, and search stays.
  await userEvent.keyboard(`{${modifier}>}`);
  await map.click();
  await userEvent.keyboard(`{/${modifier}}`);
  expect(runs.map).toHaveBeenCalledOnce();
  await expect.element(searchInput()).toHaveValue('map');
  await expect.element(searchInput()).toHaveFocus();

  await userEvent.keyboard(`{${modifier}>}{Enter}{/${modifier}}`);
  expect(runs.map).toHaveBeenCalledTimes(2);
  await expect.element(searchInput()).toHaveValue('map');

  const preview = page.getByRole('region', { name: 'Result preview' });
  await userEvent.keyboard(`{${modifier}>}`);
  await preview.getByRole('button', { name: 'Run' }).click();
  await userEvent.keyboard(`{/${modifier}}`);
  expect(runs.map).toHaveBeenCalledTimes(3);
  await expect.element(searchInput()).toHaveValue('map');

  // Without it, the action closes search.
  await userEvent.keyboard('{Enter}');
  expect(runs.map).toHaveBeenCalledTimes(4);
  await expect.element(searchDialog()).not.toBeInTheDocument();
});

it('shows a shortcut beside its item, drawn by the shortcut slot when given', async () => {
  const { list } = commands();
  const screen = await render(<Docspot search={search} items={list} />);
  await openSearch();
  await userEvent.keyboard('save');
  const save = actions().getByRole('option', { name: /Save the tree/ });
  await expect.element(save.getByText('⌘')).toBeVisible();
  await expect.element(save.getByText('S', { exact: true })).toBeVisible();
  await screen.unmount();

  await render(
    <Docspot
      search={search}
      items={list}
      slots={{ shortcut: ({ shortcut }) => <kbd>keys {shortcut}</kbd> }}
    />
  );
  await openSearch();
  await userEvent.keyboard('save');
  await expect
    .element(
      actions()
        .getByRole('option', { name: /Save the tree/ })
        .getByText('keys Meta+S')
    )
    .toBeVisible();
});

it('keeps actions out of recent pages and gives them no link to copy or open', async () => {
  const { list, runs } = commands();
  const writeText = vi
    .spyOn(navigator.clipboard, 'writeText')
    .mockResolvedValue();
  await render(
    <Docspot
      search={search}
      items={list}
      navigate={() => {}}
      history
      slots={{ preview: () => <p>Page preview</p> }}
    />
  );
  await openSearch();
  await userEvent.keyboard('save');
  const save = actions().getByRole('option', { name: /Save the tree/ });
  await expect.element(save).toHaveAttribute('aria-selected', 'true');
  // Not a link: nothing to open in a new tab.
  expect(save.element().tagName).not.toBe('A');
  expect(save.element().querySelector('a')).toBeNull();
  // Its preview says what it does and runs it, without page actions.
  const preview = page.getByRole('region', { name: 'Result preview' });
  await expect
    .element(preview.getByText('Downloads the tree as a file.'))
    .toBeVisible();
  await expect
    .element(preview.getByRole('link', { name: 'Open in new tab' }))
    .not.toBeInTheDocument();
  await userEvent.keyboard(`{${modifier}>}c{/${modifier}}`);
  expect(writeText).not.toHaveBeenCalled();

  await preview.getByRole('button', { name: 'Run' }).click();
  expect(runs.save).toHaveBeenCalledOnce();
  await openSearch();
  await expect
    .element(page.getByRole('region', { name: 'Recent' }))
    .not.toBeInTheDocument();
  expect(localStorage.getItem('docspot:recent-pages') ?? '').not.toContain(
    'save'
  );
});

it('lists items before typing in the order given, actions among pages', async () => {
  const { list, runs } = commands();
  const [theme] = list;
  await render(
    <Docspot
      search={search}
      items={list}
      defaultItems={[
        { url: '/docs/start', title: 'Introduction', group: 'Get started' },
        theme!,
        { url: '/docs/agents/setup', title: 'Connect', group: 'Popular' },
        // Without a group, an item joins the actions; a page, the suggestions.
        { url: '/docs/faq', title: 'FAQ' },
      ]}
      navigate={() => {}}
    />
  );
  await openSearch();
  await expect
    .poll(regions)
    .toEqual(['Get started', 'Actions', 'Popular', 'Suggested pages']);
  await actions()
    .getByRole('option', { name: /Thème sombre/ })
    .click();
  expect(runs.theme).toHaveBeenCalledWith({ query: '' });
});

it('places recent pages where `recentItems` sits, or first without it', async () => {
  const defaults: DocspotResult[] = [
    { url: '/docs/start', title: 'Introduction', group: 'Get started' },
    { url: '/docs/faq', title: 'FAQ', group: 'Popular' },
  ];
  const screen = await render(
    <Docspot
      search={search}
      defaultItems={[defaults[0]!, recentItems, defaults[1]!]}
      navigate={() => {}}
      history
    />
  );
  // No recent pages yet: nothing marks the place.
  await openSearch();
  await expect.poll(regions).toEqual(['Get started', 'Popular']);
  await userEvent.keyboard('{Escape}');
  await visit('http');
  await openSearch();
  await expect.poll(regions).toEqual(['Get started', 'Recent', 'Popular']);
  await screen.unmount();

  await render(
    <Docspot
      search={search}
      defaultItems={defaults}
      navigate={() => {}}
      history
    />
  );
  await openSearch();
  await expect.poll(regions).toEqual(['Recent', 'Get started', 'Popular']);
});

it('finds links among items by keyword and opens them, outside recent pages', async () => {
  const navigate = vi.fn();
  await render(
    <Docspot
      search={search}
      items={[
        defineItem({
          id: 'changelog',
          action: '/changelog',
          title: 'Changelog',
          keywords: ['releases'],
          group: 'Go to',
        }),
      ]}
      navigate={navigate}
      history
    />
  );
  await openSearch();
  await userEvent.keyboard('releases');
  const changelog = page
    .getByRole('region', { name: 'Go to' })
    .getByRole('option', { name: /Changelog/ });
  await expect.element(changelog).toHaveAttribute('href', '/changelog');
  await userEvent.keyboard('{Enter}');
  expect(navigate).toHaveBeenCalledWith('/changelog', expect.anything());
  await openSearch();
  await expect
    .element(page.getByRole('region', { name: 'Recent' }))
    .not.toBeInTheDocument();
});

it('lists a URL once when `items` and the search results both have it', async () => {
  await render(
    <Docspot
      search={() => [{ url: '/docs/query/http-api', title: 'HTTP API' }]}
      items={[
        { id: 'http-api', action: '/docs/query/http-api', title: 'HTTP API' },
      ]}
    />
  );
  await openSearch();
  await userEvent.keyboard('http');
  await expect
    .element(page.getByRole('option', { name: /HTTP API/ }))
    .toHaveLength(1);
});

it('lists an item id once even when its action changes', async () => {
  await render(
    <Docspot
      search={() => []}
      items={[
        {
          id: 'account',
          action: '/account',
          title: 'Open account',
          keywords: ['profile'],
        },
        {
          id: 'account',
          action: () => {},
          title: 'Sign out',
          keywords: ['profile'],
        },
      ]}
    />
  );
  await openSearch();
  await userEvent.keyboard('profile');
  await expect.element(page.getByRole('option')).toHaveLength(1);
  await expect
    .element(page.getByRole('option', { name: /Open account/ }))
    .toBeVisible();
});

it('does not repeat item links as handoffs', async () => {
  await render(
    <Docspot
      search={() => []}
      items={[
        {
          id: 'account',
          action: '/account',
          title: 'Open account',
          keywords: ['profile'],
        },
      ]}
      handoffs={[
        () => ({
          id: 'account-help',
          action: '/account',
          title: 'Get account help',
        }),
      ]}
    />
  );
  await openSearch();
  await userEvent.keyboard('profile');
  await expect.element(page.getByRole('option')).toHaveLength(1);
  await expect
    .element(page.getByRole('option', { name: /Open account/ }))
    .toBeVisible();
});

it('does not repeat recent pages as default URL items', async () => {
  await render(
    <Docspot
      search={({ query }) =>
        query ? [{ url: '/account', title: 'Account' }] : []
      }
      defaultItems={[
        { id: 'account-link', action: '/account', title: 'Open account' },
      ]}
      history
      navigate={() => {}}
    />
  );
  await openSearch();
  await userEvent.keyboard('account{Enter}');
  await openSearch();
  await expect
    .element(page.getByRole('region', { name: 'Recent' }))
    .toBeVisible();
  await expect.element(page.getByRole('option')).toHaveLength(1);
  await expect
    .element(page.getByRole('option', { name: /Open account/ }))
    .not.toBeInTheDocument();
});

it('previews a link to another site with its description, not the preview slot', async () => {
  await render(
    <Docspot
      search={search}
      items={[
        {
          id: 'github',
          action: 'https://github.com/example/repo',
          title: 'GitHub',
          description: 'Source code and issues.',
        },
      ]}
      slots={{ preview: () => <p>Page preview</p> }}
    />
  );
  await openSearch();
  await userEvent.keyboard('github');
  const preview = page.getByRole('region', { name: 'Result preview' });
  await expect
    .element(preview.getByText('Source code and issues.'))
    .toBeVisible();
  await expect
    .element(preview.getByText('Page preview'))
    .not.toBeInTheDocument();
});

it('previews an item with its own component, keeping the button that runs it', async () => {
  const run = vi.fn();
  await render(
    <Docspot
      search={search}
      items={[
        {
          id: 'export',
          title: 'Export',
          action: run,
          preview: ({ item, query }) => (
            <p>
              {item.title} for {query}
            </p>
          ),
        },
      ]}
      slots={{ preview: () => <p>Page preview</p> }}
    />
  );
  await openSearch();
  await userEvent.keyboard('export');
  const preview = page.getByRole('region', { name: 'Result preview' });
  await expect.element(preview.getByText('Export for export')).toBeVisible();
  await preview.getByRole('button', { name: 'Run' }).click();
  expect(run).toHaveBeenCalledWith({ query: 'export' });
});
