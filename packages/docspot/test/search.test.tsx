import type { ComponentProps } from 'react';
import { expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { Docspot, type DocspotResult, createSearch } from '@/index';
import { chatGptHandoff, claudeHandoff } from '@/handoffs';
import { createChatServer, lastQuestion, results, wait } from '@test/fixtures';

const modifier = navigator.platform.includes('Mac') ? 'Meta' : 'Control';
const searchInput = () =>
  page.getByRole('combobox', { name: 'Search documentation' });
const searchDialog = () =>
  page.getByRole('dialog', { name: 'Search documentation' });

async function openSearch(name = 'Search docs') {
  await page.getByRole('button', { name }).click();
  await expect.element(searchInput()).toHaveFocus();
}

it('groups highlighted results, previews the active one, and opens it with Enter', async () => {
  const navigate = vi.fn();
  await render(<Docspot search={() => results} navigate={navigate} />);
  await openSearch();
  await userEvent.keyboard('product');

  const lakehouse = page.getByRole('region', { name: 'Lakehouse' });
  await expect.element(lakehouse).toBeVisible();
  await expect
    .element(page.getByRole('region', { name: 'Agents' }))
    .toBeVisible();
  const first = lakehouse.getByRole('option').first();
  await expect.element(first).toHaveAttribute('aria-selected', 'true');
  await expect
    .element(first.getByText('product', { exact: true }))
    .toHaveProperty('tagName', 'MARK');
  // Without a preview slot, there is no preview pane.
  await expect
    .element(page.getByRole('region', { name: 'Result preview' }))
    .not.toBeInTheDocument();

  await userEvent.keyboard('{ArrowDown}{Enter}');
  expect(navigate).toHaveBeenCalledWith('/docs/query/http-api', {});
  await expect.element(searchDialog()).not.toBeInTheDocument();
});

it('marks matching text in titles from a search provider without highlights', async () => {
  await render(
    <Docspot search={() => [{ title: 'Configuration', url: '/config' }]} />
  );
  await openSearch();
  await userEvent.keyboard('config');
  await expect
    .element(page.getByRole('option').getByText('Config', { exact: true }))
    .toHaveProperty('tagName', 'MARK');
});

it('shows previews only when the search viewport is at least 640px wide', async () => {
  await page.viewport(390, 800);
  try {
    let finish!: (results: DocspotResult[]) => void;
    const pending = new Promise<DocspotResult[]>(resolve => {
      finish = resolve;
    });
    await render(
      <Docspot
        search={() => pending}
        slots={{ preview: ({ result }) => <p>{result.title} preview</p> }}
      />
    );
    await openSearch();
    await userEvent.keyboard('http');
    await expect
      .element(page.getByRole('paragraph').filter({ hasText: /^Searching$/ }))
      .toBeVisible();
    await expect
      .element(page.getByRole('status', { name: 'Loading preview' }))
      .not.toBeInTheDocument();

    await page.viewport(640, 800);
    await expect
      .element(page.getByRole('status', { name: 'Loading preview' }))
      .toBeVisible();
    finish(results);
    await expect.element(page.getByText('Example preview')).toBeVisible();

    await page.viewport(639, 800);
    await expect.element(page.getByText('Example preview')).not.toBeVisible();
    await expect.element(page.getByRole('option').first()).toBeVisible();
  } finally {
    await page.viewport(1440, 900);
  }
});

it('shows the Enter hint only on the selected result, beside its title', async () => {
  await render(<Docspot search={() => results} />);
  await openSearch();
  await userEvent.keyboard('product');
  const [first, second] = page.getByRole('option').all();
  await expect.element(first!).toHaveAttribute('aria-selected', 'true');
  const enterHint = (option: typeof first) =>
    option!.element().querySelector('[data-docspot-hints] svg');
  const title = first!.element().querySelector('.docspot-result-title')!;
  const titleBounds = title.getBoundingClientRect();
  const hintBounds = enterHint(first)!.getBoundingClientRect();
  expect(hintBounds.top + hintBounds.height / 2).toBeCloseTo(
    titleBounds.top + titleBounds.height / 2,
    0
  );
  // Hidden by CSS on other rows, so moving the selection renders less.
  const isShown = (option: typeof first) =>
    (enterHint(option)?.getClientRects().length ?? 0) > 0;
  expect(isShown(second)).toBe(false);
  await userEvent.keyboard('{ArrowDown}');
  await expect.element(second!).toHaveAttribute('aria-selected', 'true');
  expect(isShown(first)).toBe(false);
  expect(isShown(second)).toBe(true);
});

it('keeps native link behavior for modified clicks', async () => {
  const navigate = vi.fn();
  await render(<Docspot search={() => results} navigate={navigate} />);
  await openSearch();
  await userEvent.keyboard('http');
  const link = page.getByRole('option', { name: /HTTP API/ });
  await expect.element(link).toHaveAttribute('href', '/docs/query/http-api');
  // A modified click is left to the browser, which opens a new tab.
  link
    .element()
    .addEventListener('click', event => event.preventDefault(), { once: true });
  await link.click({ modifiers: [modifier === 'Meta' ? 'Meta' : 'Control'] });
  expect(navigate).not.toHaveBeenCalled();
  await expect.element(searchDialog()).toBeVisible();

  await link.click();
  expect(navigate).toHaveBeenCalledWith(
    '/docs/query/http-api',
    expect.anything()
  );
});

it('cancels outdated requests and never shows or opens a stale result', async () => {
  const navigate = vi.fn();
  const signals: Record<string, AbortSignal> = {};
  const search = createSearch(async ({ query, signal }) => {
    signals[query] = signal;
    if (query === 'slow') await wait(400);
    return query === 'slow'
      ? [{ url: '/stale', title: 'Stale result' }]
      : [{ url: '/fresh', title: `Fresh ${query}` }];
  });
  await render(<Docspot search={search} navigate={navigate} />);
  await openSearch();
  await userEvent.keyboard('slow');
  await wait(50);
  await userEvent.keyboard('{Backspace>4/}fresh');
  await expect
    .element(page.getByRole('option', { name: /Fresh fresh/ }))
    .toBeVisible();
  expect(signals.slow?.aborted).toBe(true);
  await wait(450);
  await expect.element(page.getByText('Stale result')).not.toBeInTheDocument();
  await userEvent.keyboard('{Enter}');
  expect(navigate).toHaveBeenCalledWith('/fresh', {});
});

it('never reports no results while a request is pending', async () => {
  const { chat } = createChatServer(() => ({ text: 'Answer.' }));
  const settled: string[] = [];
  // Like a real network: slow, and it rejects when aborted.
  const search = createSearch(
    ({ query, signal }) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => {
            settled.push(query);
            resolve(results);
          },
          query.includes('slow') ? 60_000 : 400
        );
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new DOMException('Aborted', 'AbortError'));
        });
      })
  );
  let sawNoResults = false;
  const observer = new MutationObserver(() => {
    if (document.body.textContent.includes('No results')) sawNoResults = true;
  });
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
  });
  await render(<Docspot search={search} chat={chat} />);
  await openSearch('Search or ask docs');

  // Nothing to keep yet: the list says it is searching.
  await userEvent.keyboard('deploy');
  await expect
    .element(page.getByRole('paragraph').filter({ hasText: /^Searching$/ }))
    .toBeVisible();
  await expect.poll(() => settled).toContain('deploy');
  await expect
    .element(page.getByRole('option', { name: /HTTP API/ }))
    .toBeVisible();

  // Each keystroke aborts the previous request; the results stay meanwhile.
  await userEvent.keyboard(' b');
  await expect.element(searchInput()).toHaveAttribute('aria-busy', 'true');
  await expect.element(page.getByText('HTTP API')).toBeVisible();
  await expect
    .element(page.getByRole('option', { name: /“deploy b”/ }))
    .toBeVisible();
  await expect.poll(() => settled).toContain('deploy b');
  await expect.element(searchInput()).toHaveAttribute('aria-busy', 'false');

  // A request that never returns keeps loading and keeps Ask AI live.
  await userEvent.keyboard(' slow');
  await wait(1000);
  await expect.element(searchInput()).toHaveAttribute('aria-busy', 'true');
  await expect.element(page.getByText('HTTP API')).toBeVisible();
  await expect
    .element(page.getByRole('option', { name: /“deploy b slow”/ }))
    .toBeVisible();
  observer.disconnect();
  expect(sawNoResults).toBe(false);
});

it('offers the page questions as rows when there is nothing else to list', async () => {
  const { chat, requests } = createChatServer(() => ({ text: 'Answer.' }));
  await render(
    <Docspot
      search={() => results}
      chat={chat}
      context={{
        page: {
          url: '/docs/query',
          title: 'Query data',
          prompts: ['How do I join tables?', 'Can I export results?'],
        },
      }}
    />
  );
  await openSearch('Search or ask docs');
  await expect
    .element(page.getByText('Type to search the docs.'))
    .toBeVisible();
  const ask = page.getByRole('region', { name: 'Ask AI' });
  await expect.element(ask.getByRole('option')).toHaveLength(2);
  await expect
    .element(page.getByRole('textbox', { name: /ask/i }))
    .not.toBeInTheDocument();
  await userEvent.keyboard('{ArrowDown}{Enter}');
  await expect
    .element(
      page.getByRole('complementary', { name: 'Ask AI' }).getByText('Answer.')
    )
    .toBeVisible();
  expect(lastQuestion(requests[0])).toBe('Can I export results?');
});

it('shows the full breadcrumb, even the part the group heading names', async () => {
  await render(<Docspot search={() => results} />);
  await openSearch();
  await userEvent.keyboard('sql');
  const group = page.getByRole('region', { name: 'Lakehouse' });
  const section = group.getByRole('option', { name: /Example/ });
  await expect.element(section).toBeVisible();
  expect(
    section.element().querySelector('.docspot-result-path')?.textContent
  ).toBe('Lakehouse › SQL Explorer');
});

it('reports failures, retries, and recovers from no matches', async () => {
  let fail = true;
  const search = createSearch(({ query }) => {
    if (fail) throw new Error('offline');
    return query === 'nothing' ? [] : results;
  });
  await render(<Docspot search={search} />);
  await openSearch();
  await userEvent.keyboard('sql');
  await expect.element(page.getByText('Search is unavailable')).toBeVisible();
  fail = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect
    .element(page.getByRole('option', { name: /Example/ }))
    .toBeVisible();

  await userEvent.fill(searchInput(), 'nothing');
  await expect
    .element(page.getByText('No results for “nothing”'))
    .toBeVisible();
  await expect.element(page.getByText('Try a different term.')).toBeVisible();
});

it('clears with Escape, closes with a second Escape, and restores focus', async () => {
  await render(<Docspot search={() => results} />);
  await openSearch();
  await userEvent.keyboard('sql');
  await expect.element(page.getByRole('option').first()).toBeVisible();
  await userEvent.keyboard('{Escape}');
  await expect.element(searchInput()).toHaveValue('');
  await expect.element(searchDialog()).toBeVisible();
  await userEvent.keyboard('{Escape}');
  await expect.element(searchDialog()).not.toBeInTheDocument();
  await expect
    .element(page.getByRole('button', { name: 'Search docs' }))
    .toHaveFocus();
});

it('toggles with the shortcut, once while held, and opens with slash', async () => {
  await render(<Docspot search={() => results} />);
  await userEvent.keyboard(`{${modifier}>}k{/${modifier}}`);
  await expect.element(searchInput()).toHaveFocus();
  await userEvent.keyboard(`{${modifier}>}k{/${modifier}}`);
  await expect.element(searchDialog()).not.toBeInTheDocument();

  await userEvent.keyboard(`{${modifier}>}{k>3}{/k}{/${modifier}}`);
  await expect.element(searchDialog()).toBeVisible();
  await userEvent.keyboard('{Escape}');
  await expect.element(searchDialog()).not.toBeInTheDocument();

  await userEvent.keyboard('/');
  await expect.element(searchInput()).toHaveFocus();
});

it('shows default results and recent pages before typing, with separate clearing', async () => {
  const defaults: DocspotResult[] = [
    { url: '/docs/start', title: 'Getting started' },
    { url: '/docs/query/http-api', title: 'HTTP API' },
  ];
  await render(
    <Docspot
      search={({ query }) =>
        results.filter(result => result.title.toLowerCase().includes(query))
      }
      defaultItems={defaults}
      navigate={() => {}}
      history
    />
  );
  await openSearch();
  const suggested = page.getByRole('region', { name: 'Suggested pages' });
  await expect.element(suggested.getByRole('option')).toHaveLength(2);
  await expect
    .element(page.getByRole('region', { name: 'Recent' }))
    .not.toBeInTheDocument();

  await userEvent.keyboard('http{Enter}');
  await openSearch();
  const recent = page.getByRole('region', { name: 'Recent' });
  await expect
    .element(recent.getByRole('option', { name: /HTTP API/ }))
    .toBeVisible();
  // A recent page is not suggested twice.
  await expect.element(suggested.getByRole('option')).toHaveLength(1);

  await recent.getByRole('button', { name: 'Clear history' }).click();
  await expect.element(recent).not.toBeInTheDocument();
  await expect.element(suggested.getByRole('option')).toHaveLength(2);
});

it('copies the selected link with Mod+C but keeps copying selected query text', async () => {
  const writeText = vi
    .spyOn(navigator.clipboard, 'writeText')
    .mockResolvedValue();
  await render(<Docspot search={() => results} />);
  await openSearch();
  await userEvent.keyboard('http');
  await expect
    .element(page.getByRole('option', { name: /HTTP API/ }))
    .toBeVisible();
  await userEvent.keyboard(`{ArrowDown}{${modifier}>}c{/${modifier}}`);
  expect(writeText).toHaveBeenCalledWith(
    `${location.origin}/docs/query/http-api`
  );
  await expect
    .element(page.getByText('Link to “HTTP API” copied'))
    .toBeVisible();

  writeText.mockClear();
  await userEvent.keyboard(
    `{${modifier}>}a{/${modifier}}{${modifier}>}c{/${modifier}}`
  );
  expect(writeText).not.toHaveBeenCalled();
});

it('renders slots for previews, page actions, and branding', async () => {
  function Preview({
    result,
    navigate,
  }: {
    result: DocspotResult;
    navigate: (url: string) => void;
  }) {
    return (
      <div>
        <p>Preview of {result.title}</p>
        <button type="button" onClick={() => navigate('/docs/related')}>
          Related
        </button>
      </div>
    );
  }
  const navigate = vi.fn();
  await render(
    <Docspot
      search={() => results}
      navigate={navigate}
      slots={{
        preview: Preview,
        pageActions: ({ result }) => (
          <button type="button">Share {result.title}</button>
        ),
        branding: () => <span>Search by Example</span>,
      }}
    />
  );
  await openSearch();
  await userEvent.keyboard('http');
  await expect
    .element(page.getByRole('option', { name: /HTTP API/ }))
    .toBeVisible();
  await userEvent.keyboard('{ArrowDown}');
  await expect.element(page.getByText('Preview of HTTP API')).toBeVisible();
  await expect
    .element(page.getByRole('button', { name: 'Share HTTP API' }))
    .toBeVisible();
  await expect.element(page.getByText('Search by Example')).toBeVisible();
  await page.getByRole('button', { name: 'Related' }).click();
  expect(navigate).toHaveBeenCalledWith('/docs/related', {});
});

it('records pages opened from the preview in recent pages and selection events', async () => {
  const onEvent = vi.fn();
  await render(
    <Docspot
      search={() => results}
      onEvent={onEvent}
      navigate={() => {}}
      slots={{ preview: () => null }}
    />
  );
  await openSearch();
  await userEvent.keyboard('product');
  await page.getByRole('link', { name: 'Open page' }).click();
  expect(onEvent).toHaveBeenCalledWith({
    type: 'search.select',
    query: 'product',
    position: 0,
    result: results[0],
  });
  await openSearch();
  await expect
    .element(
      page
        .getByRole('region', { name: 'Recent' })
        .getByRole('option', { name: /Example/ })
    )
    .toBeVisible();
});

it('overrides messages partially', async () => {
  await render(
    <Docspot
      search={() => []}
      messages={{
        trigger: { search: 'Find in docs' },
        search: {
          emptyTitle: 'Look something up',
          placeholder: 'Find a page…',
          placeholderWithAsk: 'Find a page or ask…',
        },
      }}
    />
  );
  await openSearch('Find in docs');
  await expect.element(page.getByText('Look something up')).toBeVisible();
  await expect
    .element(searchInput())
    .toHaveAttribute('placeholder', 'Find a page…');
  await expect
    .element(page.getByRole('button', { name: 'Close' }))
    .toBeVisible();
});

it('opens results on other sites in a new tab', async () => {
  const open = vi.spyOn(window, 'open').mockReturnValue(null);
  const navigate = vi.fn();
  await render(
    <Docspot
      search={({ query }) => [
        {
          url: `https://chat.example/?q=${encodeURIComponent(query)}`,
          title: 'Ask Example',
          group: 'Open in chat',
        },
      ]}
      navigate={navigate}
    />
  );
  await openSearch();
  await userEvent.keyboard('zoom');
  const option = page.getByRole('option', { name: /Ask Example/ });
  await expect.element(option).toHaveAttribute('target', '_blank');
  await userEvent.keyboard('{Enter}');
  expect(open).toHaveBeenCalledWith(
    'https://chat.example/?q=zoom',
    '_blank',
    'noopener,noreferrer'
  );
  expect(navigate).not.toHaveBeenCalled();
  await expect.element(searchDialog()).toBeVisible();
});

it('shows a handoff with the icon it is given', async () => {
  await render(
    <Docspot
      search={() => results}
      handoffs={[claudeHandoff({ icon: <svg data-testid="own-logo" /> })]}
    />
  );
  await openSearch();
  await userEvent.keyboard('product');
  await expect
    .element(
      page.getByRole('option', { name: /Ask Claude/ }).getByTestId('own-logo')
    )
    .toBeInTheDocument();
});

it('hands the query to other sites after the results, without recording it', async () => {
  const open = vi.spyOn(window, 'open').mockReturnValue(null);
  const onEvent = vi.fn();
  await render(
    <Docspot
      search={() => results}
      handoffs={[
        chatGptHandoff({
          prompt: ({ query, results }) => `${query}\n\nRead ${results[0]!.url}`,
        }),
        claudeHandoff(),
      ]}
      history
      onEvent={onEvent}
    />
  );
  await openSearch();
  await userEvent.keyboard('product');
  const chatGpt = page.getByRole('option', { name: /Ask ChatGPT/ });
  await expect
    .element(chatGpt)
    .toHaveAttribute(
      'href',
      `https://chatgpt.com/?q=${encodeURIComponent(`product\n\nRead ${results[0]!.url}`).replaceAll('%20', '+')}`
    );
  await expect
    .element(page.getByRole('option', { name: /Ask Claude/ }))
    .toHaveAttribute('href', 'https://claude.ai/new?q=product');
  const options = page.getByRole('option').all();
  expect(options.at(-1)!.element()).toHaveAccessibleName(/Ask Claude/);

  await userEvent.keyboard('{ArrowUp}{ArrowUp}{Enter}');
  expect(open).toHaveBeenCalledWith(
    chatGpt.element().getAttribute('href'),
    '_blank',
    'noopener,noreferrer'
  );
  expect(onEvent).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'search.select',
      item: expect.objectContaining({ id: 'chatgpt' }),
    })
  );
  await userEvent.keyboard('{Escape}');
  await expect.element(searchInput()).toHaveValue('');
  await expect
    .element(page.getByRole('region', { name: 'Recent' }))
    .not.toBeInTheDocument();
});

it('previews what a handoff sends', async () => {
  await render(
    <Docspot
      search={() => []}
      handoffs={[claudeHandoff()]}
      slots={{ preview: () => <p>Page preview</p> }}
    />
  );
  await openSearch();
  await userEvent.keyboard('product');
  await page.getByRole('option', { name: /Ask Claude/ }).hover();
  const preview = page.getByRole('region', { name: 'Result preview' });
  await expect.element(preview.getByText('“product”')).toBeVisible();
  await expect
    .element(preview.getByText('Opens a new tab with your question.'))
    .toBeVisible();
  await expect
    .element(preview.getByRole('link', { name: 'Open in new tab' }))
    .toHaveAttribute('href', 'https://claude.ai/new?q=product');
});

it('warms search when a reader shows intent to search', async () => {
  const preload = vi.fn();
  const search = createSearch(() => results, { preload });
  await render(<Docspot search={search} />);
  await page.getByRole('button', { name: 'Search docs' }).hover();
  expect(preload).toHaveBeenCalledTimes(1);
  await userEvent.keyboard(`{${modifier}>}k{/${modifier}}`);
  await expect.element(searchInput()).toHaveFocus();
  expect(preload).toHaveBeenCalledTimes(2);
});

it('keeps trigger behavior when consumers pass a ref and handlers', async () => {
  const preload = vi.fn();
  const search = createSearch(() => results, { preload });
  const ref = { current: null as HTMLButtonElement | null };
  const onFocus = vi.fn();
  const onPointerEnter = vi.fn();
  await render(
    <Docspot.Root search={search}>
      <Docspot.SearchTrigger
        ref={ref}
        onFocus={onFocus}
        onPointerEnter={onPointerEnter}
      />
      <Docspot.SearchDialog />
    </Docspot.Root>
  );
  const trigger = page.getByRole('button', { name: 'Search docs' });
  expect(ref.current).toBe(trigger.element());
  await trigger.hover();
  expect(onPointerEnter).toHaveBeenCalledTimes(1);
  expect(preload).toHaveBeenCalledTimes(1);

  // Focus still returns to the trigger, which its own ref also holds.
  await userEvent.keyboard('/');
  await expect.element(searchInput()).toHaveFocus();
  await userEvent.keyboard('{Escape}');
  await expect.element(trigger).toHaveFocus();
  expect(onFocus).toHaveBeenCalled();
  expect(preload).toHaveBeenCalledTimes(3);
});

it('applies a base message override when its WithAsk variant is not overridden', async () => {
  const { chat } = createChatServer(() => ({ text: 'Answer.' }));
  await render(
    <Docspot
      search={() => []}
      chat={chat}
      messages={{
        trigger: { search: 'Find in docs' },
        search: { placeholder: 'Find a page…' },
      }}
    />
  );
  await openSearch('Find in docs');
  await expect
    .element(searchInput())
    .toHaveAttribute('placeholder', 'Find a page…');
});

it('selects results with the accent a dark theme sets', async () => {
  document.documentElement.dataset.theme = 'dark';
  document.documentElement.style.setProperty(
    '--docspot-accent',
    'rgb(1, 2, 3)'
  );
  try {
    await render(<Docspot search={() => results} />);
    await openSearch();
    await userEvent.keyboard('product');
    const selected = page.getByRole('option', { selected: true });
    await expect
      .element(selected)
      .toHaveStyle({ backgroundColor: 'rgb(1, 2, 3)' });
  } finally {
    document.documentElement.removeAttribute('data-theme');
  }
});

it('renders a trigger as another element or with a function', async () => {
  const onClick = vi.fn();
  function Button({ className, ...props }: ComponentProps<'button'>) {
    return <button {...props} className={`${className} ds-button`} />;
  }
  await render(
    <Docspot.Root search={() => results}>
      <Docspot.SearchTrigger render={<Button onClick={onClick} />} />
      <Docspot.SearchTrigger
        render={(props, state) => (
          <button {...props}>{state.open ? 'Searching' : 'Find'}</button>
        )}
      />
      <Docspot.SearchDialog />
    </Docspot.Root>
  );
  const trigger = page.getByRole('button', { name: 'Search docs' });
  await expect.element(trigger).toHaveClass('docspot-trigger');
  await expect.element(trigger).toHaveClass('ds-button');
  await expect
    .element(trigger)
    .toHaveAttribute('aria-keyshortcuts', 'Meta+K Control+K /');
  await trigger.click();
  expect(onClick).toHaveBeenCalledTimes(1);
  await expect.element(searchInput()).toHaveFocus();
  await expect
    .element(
      page.getByRole('button', { name: 'Searching', includeHidden: true })
    )
    .toBeInTheDocument();
  await userEvent.keyboard('{Escape}');
  await expect.element(trigger).toHaveFocus();
  await expect
    .element(page.getByRole('button', { name: 'Find' }))
    .toBeInTheDocument();
});
