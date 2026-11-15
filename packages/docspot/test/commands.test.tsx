import { expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { Docspot, type DocspotCommand, type DocspotEvent } from '../src';
import { results } from './fixtures';

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

function commands() {
  const runs = { theme: vi.fn(), save: vi.fn(), map: vi.fn() };
  const list: DocspotCommand[] = [
    {
      id: 'theme',
      title: 'Thème sombre',
      keywords: ['dark theme'],
      run: runs.theme,
    },
    {
      id: 'save',
      title: 'Save the tree',
      shortcut: 'Meta+S',
      description: 'Downloads the tree as a file.',
      run: runs.save,
    },
    { id: 'map', title: 'Map', group: 'Go to', run: runs.map },
  ];
  return { list, runs };
}

it('lists the commands the query names, in their own group before the results, and runs one with Enter', async () => {
  const { list, runs } = commands();
  const events: DocspotEvent[] = [];
  await render(
    <Docspot
      search={search}
      commands={list}
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
  await expect
    .poll(() =>
      page
        .getByRole('region')
        .elements()
        .map(region => region.getAttribute('aria-label'))
    )
    .toEqual(['Actions', 'Lakehouse', 'Agents']);

  await userEvent.fill(searchInput(), 'theme');
  await expect
    .element(actions().getByRole('option').first())
    .toHaveAttribute('aria-selected', 'true');
  await userEvent.keyboard('{Enter}');
  expect(runs.theme).toHaveBeenCalledOnce();
  await expect.element(searchDialog()).not.toBeInTheDocument();
  expect(events).toContainEqual({
    type: 'search.command',
    query: 'theme',
    command: 'theme',
  });
});

it('runs a command on click, with commands its only matches, in a group of its own', async () => {
  const { list, runs } = commands();
  await render(<Docspot search={search} commands={list} />);
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

it('shows a shortcut beside its command, drawn by the shortcut slot when given', async () => {
  const { list } = commands();
  const screen = await render(<Docspot search={search} commands={list} />);
  await openSearch();
  await userEvent.keyboard('save');
  const save = actions().getByRole('option', { name: /Save the tree/ });
  await expect.element(save.getByText('⌘')).toBeVisible();
  await expect.element(save.getByText('S', { exact: true })).toBeVisible();
  await screen.unmount();

  await render(
    <Docspot
      search={search}
      commands={list}
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

it('keeps commands out of recent pages and gives them no link to copy or open', async () => {
  const { list, runs } = commands();
  const writeText = vi
    .spyOn(navigator.clipboard, 'writeText')
    .mockResolvedValue();
  await render(
    <Docspot
      search={search}
      commands={list}
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
