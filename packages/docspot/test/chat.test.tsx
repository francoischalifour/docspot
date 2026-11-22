import { expect, it, vi } from 'vitest';
import { commands, page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import {
  Docspot,
  type DocspotLoadPage,
  type DocspotPage,
  useDocspot,
} from '@/index';
import { createChat } from '@/chat';
import type { DocspotUrlAdapter } from '@/types';
import { createChatServer, lastQuestion, wait } from '@test/fixtures';

const modifier = navigator.platform.includes('Mac') ? 'Meta' : 'Control';
const panel = () => page.getByRole('complementary', { name: 'Ask AI' });
const composer = () => panel().getByRole('textbox');
const answers = () => panel().getByRole('article', { name: 'Docs answer' });

const guide: DocspotPage = {
  url: '/docs/guides/zoom',
  title: 'Zoom guide',
  prompts: ['How do I zoom an image?'],
};

async function openChat() {
  await page.getByRole('button', { name: 'Ask AI' }).first().click();
  await expect.element(composer()).toHaveFocus();
}

it('works without search: prompts, page context, streaming Markdown, and sources', async () => {
  const { chat, requests } = createChatServer(() => ({
    chunks: ['Call **zoom', '()** on the image.'],
    chunkDelayMs: 150,
    sources: [{ url: '/docs/guides/zoom', title: 'Zoom guide' }],
  }));
  const loadPage = vi.fn<DocspotLoadPage>(async () => ({
    content: '# Zoom guide\nUse zoom().',
  }));
  await render(
    <Docspot
      chat={chat}
      context={{ page: guide, prompts: ['Default question'] }}
      loadPage={loadPage}
    />
  );
  // Chat-only exposes chat controls and shortcuts, not search.
  await expect
    .element(page.getByRole('button', { name: /Search/ }))
    .not.toBeInTheDocument();
  await userEvent.keyboard(`{${modifier}>}k{/${modifier}}`);
  await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();

  await openChat();
  await expect
    .element(panel().getByRole('heading', { name: 'Ask AI about these docs' }))
    .toBeVisible();
  await expect.element(panel().getByText('Page context:')).toBeInTheDocument();
  await panel()
    .getByRole('button', { name: 'How do I zoom an image?' })
    .click();

  // Bold text renders while it is still streaming.
  await expect
    .element(answers().getByText('zoom', { exact: true }))
    .toHaveProperty('tagName', 'STRONG');
  await expect.element(answers().getByText(/on the image/)).toBeVisible();
  await expect
    .element(answers().getByRole('link', { name: 'Zoom guide' }))
    .toHaveAttribute('href', '/docs/guides/zoom');
  await expect
    .element(panel().getByRole('button', { name: 'Copy answer' }))
    .toBeInTheDocument();
  expect(panel().element().querySelector('time')).not.toBeNull();

  expect(loadPage).toHaveBeenCalledTimes(1);
  // Backends receive the page's absolute URL.
  expect(requests[0]?.body.docspot?.page).toEqual({
    url: `${location.origin}/docs/guides/zoom`,
    title: 'Zoom guide',
    content: '# Zoom guide\nUse zoom().',
  });

  // Removing the page sends the next question without it.
  await panel().getByRole('button', { name: 'Remove page context' }).click();
  await userEvent.fill(composer(), 'And without the page?');
  await userEvent.keyboard('{Enter}');
  await expect.element(answers()).toHaveLength(2);
  expect(requests[1]?.body.docspot?.page).toBeUndefined();
});

it('keeps completing inline Markdown after a streamed code block closes', async () => {
  const { chat } = createChatServer(() => ({
    chunks: ['```ts\nconst value = 1;\n```\n\nThis is **bold', ' text**.'],
    chunkDelayMs: 500,
  }));
  await render(<Docspot chat={chat} />);
  await openChat();
  await userEvent.keyboard('Show an example{Enter}');
  await expect
    .element(answers().getByText('bold', { exact: true }))
    .toHaveProperty('tagName', 'STRONG');
});

it('shows tool progress, stops, and retries the latest answer in place', async () => {
  const { chat, requests } = createChatServer((_, index) =>
    index === 0
      ? {
          toolQuery: 'zoom margin',
          chunks: ['Never', ' finishes', '.'],
          chunkDelayMs: 2000,
        }
      : { text: `Answer ${index}.` }
  );
  await render(<Docspot chat={chat} />);
  await openChat();
  await userEvent.keyboard('What is the margin?{Enter}');
  await expect
    .element(
      panel().getByRole('status').getByText('Searching for “zoom margin”')
    )
    .toBeVisible();
  await panel().getByRole('button', { name: 'Stop response' }).click();
  await expect
    .element(panel().getByRole('button', { name: 'Send question' }))
    .toBeVisible();
  expect(requests[0]?.signal?.aborted).toBe(true);

  await userEvent.fill(composer(), 'Try once more');
  await userEvent.keyboard('{Enter}');
  await expect.element(answers().getByText('Answer 1.')).toBeVisible();
  await panel().getByRole('button', { name: 'Retry answer' }).click();
  await expect.element(answers().getByText('Answer 2.')).toBeVisible();
  await expect
    .element(answers().getByText('Answer 1.'))
    .not.toBeInTheDocument();
  expect(lastQuestion(requests[2])).toBe('Try once more');
});

it('recovers from a failed answer', async () => {
  const { chat } = createChatServer((_, index) =>
    index === 0 ? { status: 500 } : { text: 'Recovered.' }
  );
  await render(<Docspot chat={chat} />);
  await openChat();
  await userEvent.keyboard('Hello?{Enter}');
  const alert = panel().getByRole('alert');
  await expect
    .element(alert)
    .toHaveTextContent('Couldn’t get an answer.Try again');
  await expect
    .element(panel().getByRole('status').getByText('Answer failed'))
    .toBeInTheDocument();
  await expect
    .element(panel().getByText('Answer ready'))
    .not.toBeInTheDocument();
  await alert.getByRole('button', { name: 'Try again' }).click();
  await expect.element(answers().getByText('Recovered.')).toBeVisible();
});

it('replaces an in-flight answer when a new question arrives', async () => {
  const { chat, requests } = createChatServer(question =>
    question === 'First'
      ? { chunks: ['Slow', ' first', ' answer'], chunkDelayMs: 1000 }
      : { text: 'Second answer.' }
  );
  function AskButton() {
    const docspot = useDocspot();
    return (
      <button type="button" onClick={() => docspot.submitQuestion('Second')}>
        Ask second
      </button>
    );
  }
  await render(
    <Docspot.Root chat={chat}>
      <Docspot.ChatTrigger />
      <AskButton />
      <Docspot.ChatPanel />
    </Docspot.Root>
  );
  await page.getByRole('button', { name: 'Ask AI' }).first().click();
  await userEvent.keyboard('First{Enter}');
  await expect.element(answers().getByText('Slow')).toBeVisible();
  await page.getByRole('button', { name: 'Ask second' }).click();
  await expect.element(answers().getByText('Second answer.')).toBeVisible();
  expect(requests[0]?.signal?.aborted).toBe(true);
  expect(lastQuestion(requests[1])).toBe('Second');
});

it('replaces the earlier question when submissions happen in one event', async () => {
  const { chat, requests } = createChatServer(question =>
    question === 'First'
      ? { chunks: ['Slow first answer'], chunkDelayMs: 2000 }
      : { text: 'Second answer.' }
  );
  function AskBothButton() {
    const docspot = useDocspot();
    return (
      <button
        type="button"
        onClick={() => {
          docspot.submitQuestion('First');
          docspot.submitQuestion('Second');
        }}
      >
        Ask both
      </button>
    );
  }
  await render(
    <Docspot.Root chat={chat}>
      <Docspot.ChatTrigger />
      <AskBothButton />
      <Docspot.ChatPanel />
    </Docspot.Root>
  );
  await page.getByRole('button', { name: 'Ask AI' }).first().click();
  await page.getByRole('button', { name: 'Ask both' }).click();
  await expect.element(answers().getByText('Second answer.')).toBeVisible();
  expect(lastQuestion(requests.at(-1))).toBe('Second');
  expect(requests[0]?.signal?.aborted).toBe(true);
});

it('restores the open panel, its conversation, and the draft after a reload', async () => {
  const { chat } = createChatServer(question => ({
    text: `About ${question}.`,
  }));
  const screen = await render(<Docspot chat={chat} history />);
  await openChat();
  await userEvent.keyboard('First question{Enter}');
  await expect
    .element(answers().getByText('About First question.'))
    .toBeVisible();
  await userEvent.fill(composer(), 'Unsent draft');
  await screen.unmount();

  await render(<Docspot chat={chat} history />);
  await expect
    .element(panel().getByText('About First question.'))
    .toBeVisible();
  await expect.element(composer()).toHaveValue('Unsent draft');
});

it('starts closed on a phone after a reload', async () => {
  const { chat } = createChatServer(() => ({ text: 'Hi.' }));
  const screen = await render(<Docspot chat={chat} history />);
  await openChat();
  await page.viewport(390, 800);
  await screen.unmount();
  await render(<Docspot chat={chat} history />);
  await wait(200);
  await expect.element(panel()).not.toBeInTheDocument();
  await page.viewport(1440, 900);
});

it('switches, deletes, and clears conversations', async () => {
  const { chat } = createChatServer(question => ({
    text: `About ${question}.`,
  }));
  await render(<Docspot chat={chat} history />);
  await openChat();
  for (const question of ['Alpha', 'Beta']) {
    await userEvent.fill(composer(), question);
    await userEvent.keyboard('{Enter}');
    await expect
      .element(answers().getByText(`About ${question}.`))
      .toBeVisible();
    await panel().getByRole('button', { name: 'New chat' }).click();
  }
  await panel().getByRole('button', { name: 'Switch chat, New chat' }).click();
  const menu = page.getByRole('menu');
  await menu.getByRole('menuitem', { name: 'Alpha', exact: true }).click();
  await expect.element(answers().getByText('About Alpha.')).toBeVisible();

  await panel().getByRole('button', { name: 'Switch chat, Alpha' }).click();
  await menu.getByRole('menuitem', { name: 'Delete chat, Beta' }).click();
  await expect
    .element(menu.getByRole('menuitem', { name: 'Beta', exact: true }))
    .not.toBeInTheDocument();
  await menu.getByRole('menuitem', { name: 'Clear history…' }).click();
  await menu.getByRole('menuitem', { name: 'Confirm clear history' }).click();
  await expect
    .element(panel().getByRole('heading', { name: 'Ask AI about these docs' }))
    .toBeVisible();
  await panel().getByRole('button', { name: 'Switch chat, New chat' }).click();
  await expect.element(menu.getByText('No recent chats')).toBeVisible();
});

it('opens from question links and removes them from the URL', async () => {
  history.replaceState(
    null,
    '',
    '/docs?tab=react&prompt=How%20to%20zoom%3F&askPage=%2Fdocs%2Fguides%2Fzoom'
  );
  const { chat, requests } = createChatServer(() => ({ text: 'Like this.' }));
  await render(
    <Docspot
      chat={chat}
      syncUrl
      context={{ resolvePage: url => (url === guide.url ? guide : undefined) }}
    />
  );
  await expect.element(answers().getByText('Like this.')).toBeVisible();
  expect(location.search).toBe('?tab=react');
  expect(lastQuestion(requests[0])).toBe('How to zoom?');
  expect(requests[0]?.body.docspot?.page).toMatchObject({
    url: `${location.origin}/docs/guides/zoom`,
    title: 'Zoom guide',
  });
  await expect.element(panel().getByText('Zoom guide')).toBeVisible();

  history.pushState(null, '', '/docs?draft=Edit%20me');
  dispatchEvent(new PopStateEvent('popstate'));
  await expect.element(composer()).toHaveValue('Edit me');
  expect(location.search).toBe('');
  expect(requests).toHaveLength(1);
});

it('opens the same question link again after router navigation', async () => {
  let search = '?prompt=Ask%20again';
  let notifyLocationChange: (() => void) | undefined;
  const adapter: DocspotUrlAdapter = {
    read: () => search,
    write(next) {
      search = next ? `?${next}` : '';
    },
    subscribe(listener) {
      notifyLocationChange = listener;
      return () => {
        notifyLocationChange = undefined;
      };
    },
  };
  const { chat, requests } = createChatServer(() => ({ text: 'Again.' }));
  await render(<Docspot chat={chat} syncUrl={adapter} />);
  await expect.element(answers().getByText('Again.')).toBeVisible();
  expect(search).toBe('');

  search = '?prompt=Ask%20again';
  notifyLocationChange?.();
  await expect.poll(() => requests).toHaveLength(2);
});

it('closes with Escape and the shortcut, returning focus', async () => {
  const { chat } = createChatServer(() => ({ text: 'Hi.' }));
  await render(<Docspot chat={chat} />);
  await openChat();
  await userEvent.keyboard('{Escape}');
  await expect.element(panel()).not.toBeInTheDocument();
  await expect
    .element(page.getByRole('button', { name: 'Ask AI' }).first())
    .toHaveFocus();
  await userEvent.keyboard(`{${modifier}>}j{/${modifier}}`);
  await expect.element(composer()).toHaveFocus();
  await userEvent.keyboard(`{${modifier}>}j{/${modifier}}`);
  await expect.element(panel()).not.toBeInTheDocument();
});

it('anchors a streamed answer at its start instead of following its end', async () => {
  const { chat } = createChatServer(
    () => ({
      preamble: 'One moment please.',
      toolQuery: 'query data',
      chunks: [
        'Start reading here.\n\n',
        ...Array.from(
          { length: 40 },
          () => 'More details about querying your data.\n\n'
        ),
      ],
      chunkDelayMs: 60,
    }),
    { holdFirstStep: true }
  );
  await render(<Docspot search={() => []} chat={chat} />);
  await page.getByRole('button', { name: 'Search or ask docs' }).click();
  await userEvent.keyboard('How do I query my data?{Tab}');
  const answer = answers().first();
  await expect.element(answer).toHaveTextContent('Start reading here.');
  const viewport = panel()
    .element()
    .querySelector<HTMLElement>('.docspot-scroller-viewport')!;
  const expectAnswerStart = () => {
    const top = answer.element().getBoundingClientRect().top;
    const bounds = viewport.getBoundingClientRect();
    expect(top).toBeGreaterThanOrEqual(bounds.top);
    expect(top).toBeLessThan(bounds.top + 48);
  };
  await vi.waitFor(expectAnswerStart);
  await vi.waitFor(
    () => {
      expect(answer.element().getBoundingClientRect().height).toBeGreaterThan(
        viewport.clientHeight
      );
      expectAnswerStart();
    },
    { timeout: 4000 }
  );
  // The rest of a long answer is below, so jumping to it is offered.
  await expect
    .element(panel().getByRole('button', { name: 'Jump to latest answer' }))
    .toBeInTheDocument();
});

it('starts a fresh session when the chat transport changes', async () => {
  const first = createChatServer(() => ({ text: 'First answer.' }));
  const second = createChatServer(() => ({ text: 'Second answer.' }));
  const screen = await render(<Docspot chat={first.chat} />);
  await openChat();
  await userEvent.keyboard('First question{Enter}');
  await expect.element(answers().getByText('First answer.')).toBeVisible();

  await screen.rerender(<Docspot chat={second.chat} />);
  await expect.element(panel()).not.toBeInTheDocument();
  await openChat();
  await userEvent.keyboard('Second question{Enter}');
  await expect.element(answers().getByText('Second answer.')).toBeVisible();
});

it('retries startup once and keeps a linked question for a manual retry', async () => {
  const { transport, requests } = createChatServer(() => ({
    text: 'Recovered.',
  }));
  const load = vi
    .fn(async () => transport)
    .mockRejectedValueOnce(new Error('Offline'))
    .mockRejectedValueOnce(new Error('Offline'));
  history.replaceState(null, '', '?prompt=Pending&lang=en');
  await render(<Docspot chat={createChat({ transport: load })} syncUrl />);
  await expect.element(panel().getByText('Opening chat')).toBeVisible();
  await expect.element(panel().getByText('Couldn’t open chat.')).toBeVisible();
  expect(load).toHaveBeenCalledTimes(2);
  expect(requests).toHaveLength(0);
  await panel().getByRole('button', { name: 'Try again' }).click();
  await expect.element(answers().getByText('Recovered.')).toBeVisible();
  expect(requests.map(lastQuestion)).toEqual(['Pending']);
  expect(location.search).toBe('?lang=en');
});

it('opens after a transient startup failure without asking the reader to retry', async () => {
  const { transport, requests } = createChatServer(() => ({
    text: 'Recovered.',
  }));
  const load = vi
    .fn(async () => transport)
    .mockRejectedValueOnce(new Error('Offline'));
  history.replaceState(null, '', '?prompt=Pending');
  await render(<Docspot chat={createChat({ transport: load })} syncUrl />);
  await expect.element(answers().getByText('Recovered.')).toBeVisible();
  expect(load).toHaveBeenCalledTimes(2);
  expect(requests.map(lastQuestion)).toEqual(['Pending']);
});

it('drops a pending linked question when chat closes during startup', async () => {
  const { transport, requests } = createChatServer(() => ({
    text: 'Unexpected.',
  }));
  let release!: () => void;
  const ready = new Promise<void>(resolve => {
    release = resolve;
  });
  history.replaceState(null, '', '?prompt=Cancelled&lang=en');
  await render(
    <Docspot
      chat={createChat({
        transport: async () => {
          await ready;
          return transport;
        },
      })}
      syncUrl
    />
  );
  await expect.element(panel().getByText('Opening chat')).toBeVisible();
  await panel().getByRole('button', { name: 'Hide Ask AI' }).click();
  release();
  expect(location.search).toBe('?lang=en');
  await openChat();
  await expect
    .element(panel().getByText('Ask AI about these docs'))
    .toBeVisible();
  expect(requests).toHaveLength(0);
});

it('opens sources on this site in place and others in a new tab', async () => {
  const { chat } = createChatServer(() => ({
    text: 'See the guide.',
    sources: [
      { url: '/docs/guides/zoom', title: 'Zoom guide' },
      { url: 'https://example.org/zoom', title: 'Elsewhere' },
    ],
  }));
  const navigate = vi.fn();
  await render(<Docspot chat={chat} navigate={navigate} />);
  await openChat();
  await userEvent.keyboard('Where is zoom?{Enter}');
  const internal = answers().getByRole('link', { name: 'Zoom guide' });
  await expect.element(internal).not.toHaveAttribute('target');
  await expect
    .element(answers().getByRole('link', { name: 'Elsewhere' }))
    .toHaveAttribute('target', '_blank');
  await internal.click();
  expect(navigate).toHaveBeenCalledWith(
    '/docs/guides/zoom',
    expect.objectContaining({ event: expect.anything() })
  );
});

it('offers to jump only when more of the answer is below', async () => {
  const { chat } = createChatServer(() => ({
    chunks: ['A short answer.', ' It fits.'],
    chunkDelayMs: 100,
  }));
  await render(<Docspot chat={chat} />);
  await openChat();
  await userEvent.keyboard('Is it short?{Enter}');
  await expect
    .element(panel().getByRole('button', { name: 'Copy answer' }))
    .toBeInTheDocument();
  // The space kept below a short answer for reading is not more to read.
  await expect
    .element(panel().getByRole('button', { name: 'Jump to latest answer' }))
    .not.toBeInTheDocument();
});

declare module 'vitest/browser' {
  interface BrowserCommands {
    wheel: (role: 'log', name: string, deltaY: number) => Promise<void>;
  }
}

it('stays where the reader scrolled while an answer streams, until they jump back', async () => {
  const { chat } = createChatServer(() => ({
    chunks: [
      'Start reading here.\n\n',
      ...Array.from(
        { length: 60 },
        (_, index) => `Paragraph ${index} about querying data.\n\n`
      ),
      'The very end.',
    ],
    chunkDelayMs: 40,
  }));
  await render(<Docspot chat={chat} />);
  await openChat();
  await userEvent.keyboard('Tell me everything{Enter}');
  const answer = answers().first();
  await expect.element(answer).toHaveTextContent('Paragraph 5');

  // Scrolling up while it streams leaves the reader there.
  await commands.wheel('log', 'Chat', -150);
  await vi.waitFor(() =>
    expect(answer.element().getBoundingClientRect().top).toBeGreaterThan(
      panel().element().getBoundingClientRect().top + 120
    )
  );
  const top = answer.element().getBoundingClientRect().top;
  await expect.element(answer).toHaveTextContent('Paragraph 30');
  expect(
    Math.abs(answer.element().getBoundingClientRect().top - top)
  ).toBeLessThan(2);

  await expect.element(answer).toHaveTextContent('The very end.');
  await panel().getByRole('button', { name: 'Jump to latest answer' }).click();
  await expect.element(answer.getByText('The very end.')).toBeInViewport();
});
