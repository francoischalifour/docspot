import { expect, it, vi } from 'vitest';
import { commands, page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import {
  Docspot,
  type DocspotLoadPage,
  type DocspotIconProps,
  type DocspotPage,
  useDocspot,
} from '@/index';
import { type DocspotToolProps, createChat } from '@/chat';
import type { DocspotUrlAdapter } from '@/types';
import { wait } from '@test/fixtures';
import { createTestChat } from '@test/testing';

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

it('loads chat only on opening when automatic preload is disabled', async () => {
  const { transport } = createTestChat({ answer: () => ({ text: 'Hi.' }) });
  let loads = 0;
  const chat = createChat({
    transport: async () => {
      loads += 1;
      return transport;
    },
  });
  await render(
    <Docspot.Root chat={chat} preload={false}>
      <Docspot.ChatLauncher />
      <Docspot.ChatPanel />
    </Docspot.Root>
  );
  const launcher = page.getByRole('button', { name: 'Ask AI' });
  await launcher.hover();
  await userEvent.keyboard('{Tab}');
  await expect.element(launcher).toHaveFocus();
  expect(loads).toBe(0);
  await launcher.click();
  await expect.element(composer()).toHaveFocus();
  expect(loads).toBe(1);
});

it('floats a launcher while chat is hidden, and returns focus to it', async () => {
  const { chat } = createTestChat({ answer: () => ({ text: 'Hi.' }) });
  let allow = false;
  await render(
    <Docspot.Root chat={chat}>
      <Docspot.ChatLauncher
        className="site-launcher"
        onClick={event => {
          if (!allow) event.preventDefault();
        }}
      />
      <Docspot.ChatPanel />
    </Docspot.Root>
  );
  const launcher = page.getByRole('button', { name: 'Ask AI', exact: true });
  await expect.element(launcher).toHaveClass('docspot-launcher site-launcher');
  // The site's handler runs first and can keep chat closed.
  await launcher.click();
  await expect.element(panel()).not.toBeInTheDocument();
  allow = true;
  await launcher.click();
  await expect.element(composer()).toHaveFocus();
  await expect.element(launcher).not.toBeInTheDocument();
  await userEvent.keyboard(`{${modifier}>}j{/${modifier}}`);
  await expect.element(launcher).toHaveFocus();
});

it('works without search: prompts, page context, streaming Markdown, and sources', async () => {
  // The test streams the first answer; the second is scripted.
  const { chat, requests, nextRequest } = createTestChat({
    answer: ({ index }) => (index === 0 ? undefined : 'Without the page.'),
  });
  const loadPage = vi.fn<DocspotLoadPage>(async () => ({
    content: '# Zoom guide\nUse zoom().',
  }));
  await render(
    <Docspot
      chat={chat}
      context={{ page: guide, prompts: ['Default question'], loadPage }}
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
  // The suggestions leave once asked; typing goes on in the composer.
  await expect.element(composer()).toHaveFocus();

  // Bold text renders while it is still streaming.
  const reply = await nextRequest();
  reply.text('Call **zoom');
  await expect
    .element(answers().getByText('zoom', { exact: true }))
    .toHaveProperty('tagName', 'STRONG');
  reply.text('()** on the image.');
  reply.source({ url: '/docs/guides/zoom', title: 'Zoom guide' });
  reply.end();
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
  expect(requests[0]?.page).toEqual({
    url: `${location.origin}/docs/guides/zoom`,
    title: 'Zoom guide',
    content: '# Zoom guide\nUse zoom().',
  });

  // Removing the page sends the next question without it.
  await panel().getByRole('button', { name: 'Remove page context' }).click();
  await userEvent.fill(composer(), 'And without the page?');
  await userEvent.keyboard('{Enter}');
  await expect.element(answers()).toHaveLength(2);
  expect(requests[1]?.page).toBeUndefined();
});

it('keeps completing inline Markdown after a streamed code block closes', async () => {
  const { chat, nextRequest } = createTestChat();
  await render(<Docspot chat={chat} />);
  await openChat();
  await userEvent.keyboard('Show an example{Enter}');
  const reply = await nextRequest();
  reply.text('```ts\nconst value = 1;\n```\n\nThis is **bold');
  await expect
    .element(answers().getByText('bold', { exact: true }))
    .toHaveProperty('tagName', 'STRONG');
  reply.text(' text**.');
  reply.end();
  await expect
    .element(answers().getByText('bold text', { exact: true }))
    .toHaveProperty('tagName', 'STRONG');
});

it('shows tool progress, stops, and retries the latest answer in place', async () => {
  const { chat, requests, nextRequest } = createTestChat({
    answer: ({ index }) => (index === 0 ? undefined : `Answer ${index}.`),
  });
  await render(<Docspot chat={chat} />);
  await openChat();
  await userEvent.keyboard('What is the margin?{Enter}');
  // The search runs until the reader stops it.
  (await nextRequest()).tool('searchDocs', { query: 'zoom margin' });
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
  expect(requests[2]?.question).toBe('Try once more');
});

it('recovers from a failed answer', async () => {
  const { chat } = createTestChat({
    answer: ({ index }) =>
      index === 0 ? { status: 500 } : { text: 'Recovered.' },
  });
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
  const { chat, requests, nextRequest } = createTestChat({
    // The first answer never finishes.
    answer: ({ question }) =>
      question === 'First' ? undefined : 'Second answer.',
  });
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
  (await nextRequest()).text('Slow');
  await expect.element(answers().getByText('Slow')).toBeVisible();
  await page.getByRole('button', { name: 'Ask second' }).click();
  await expect.element(answers().getByText('Second answer.')).toBeVisible();
  expect(requests[0]?.signal?.aborted).toBe(true);
  expect(requests[1]?.question).toBe('Second');
});

it('replaces the earlier question when submissions happen in one event', async () => {
  const { chat, requests } = createTestChat({
    // The first answer never finishes; nothing drives it.
    answer: ({ question }) =>
      question === 'First' ? undefined : 'Second answer.',
  });
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
  expect(requests.at(-1)?.question).toBe('Second');
  expect(requests[0]?.signal?.aborted).toBe(true);
});

it('restores the open panel, its conversation, and the draft after a reload', async () => {
  const { chat } = createTestChat({
    answer: ({ question }) => ({
      text: `About ${question}.`,
    }),
  });
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
  const { chat } = createTestChat({ answer: () => ({ text: 'Hi.' }) });
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
  const { chat } = createTestChat({
    answer: ({ question }) => ({
      text: `About ${question}.`,
    }),
  });
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
  // Focus moves on to the next row, so the keyboard keeps working.
  await expect
    .element(menu.getByRole('menuitem', { name: 'Alpha', exact: true }))
    .toHaveFocus();
  await userEvent.keyboard('{End}');
  await expect
    .element(menu.getByRole('menuitem', { name: 'Clear history…' }))
    .toHaveFocus();
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
  const { chat, requests } = createTestChat({
    answer: () => ({ text: 'Like this.' }),
  });
  await render(
    <Docspot
      chat={chat}
      syncUrl
      context={{ resolvePage: url => (url === guide.url ? guide : undefined) }}
    />
  );
  await expect.element(answers().getByText('Like this.')).toBeVisible();
  expect(location.search).toBe('?tab=react');
  expect(requests[0]?.question).toBe('How to zoom?');
  expect(requests[0]?.page).toMatchObject({
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
  const { chat, requests } = createTestChat({
    answer: () => ({ text: 'Again.' }),
  });
  await render(<Docspot chat={chat} syncUrl={adapter} />);
  await expect.element(answers().getByText('Again.')).toBeVisible();
  expect(search).toBe('');

  search = '?prompt=Ask%20again';
  notifyLocationChange?.();
  await expect.poll(() => requests).toHaveLength(2);
});

it('closes with Escape and the shortcut, returning focus', async () => {
  const { chat } = createTestChat({ answer: () => ({ text: 'Hi.' }) });
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
  const { chat, nextRequest } = createTestChat({ holdFirstStep: true });
  await render(<Docspot search={() => []} chat={chat} />);
  await page.getByRole('button', { name: 'Search or ask docs' }).click();
  await userEvent.keyboard('How do I query my data?{Tab}');
  // The agent narrates, searches, then answers.
  const reply = await nextRequest();
  reply.text('One moment please.');
  reply.tool('searchDocs', { query: 'query data' }).output({ hits: 3 });
  reply.text('Start reading here.\n\n');
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
  // The answer grows past the viewport while it streams.
  for (let batch = 1; batch <= 4; batch++) {
    for (let line = 0; line < 10; line++)
      reply.text(`Detail ${batch}.${line} about querying your data.\n\n`);
    await expect.element(answer).toHaveTextContent(`Detail ${batch}.9`);
    expectAnswerStart();
  }
  expect(answer.element().getBoundingClientRect().height).toBeGreaterThan(
    viewport.clientHeight
  );
  // The rest of a long answer is below, so jumping to it is offered.
  await expect
    .element(panel().getByRole('button', { name: 'Jump to latest answer' }))
    .toBeInTheDocument();
});

it('starts a fresh session when the chat transport changes', async () => {
  const first = createTestChat({ answer: () => ({ text: 'First answer.' }) });
  const second = createTestChat({ answer: () => ({ text: 'Second answer.' }) });
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
  const { transport, requests } = createTestChat({
    answer: () => ({
      text: 'Recovered.',
    }),
  });
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
  expect(requests.map(request => request.question)).toEqual(['Pending']);
  expect(location.search).toBe('?lang=en');
});

it('opens after a transient startup failure without asking the reader to retry', async () => {
  const { transport, requests } = createTestChat({
    answer: () => ({
      text: 'Recovered.',
    }),
  });
  const load = vi
    .fn(async () => transport)
    .mockRejectedValueOnce(new Error('Offline'));
  history.replaceState(null, '', '?prompt=Pending');
  await render(<Docspot chat={createChat({ transport: load })} syncUrl />);
  await expect.element(answers().getByText('Recovered.')).toBeVisible();
  expect(load).toHaveBeenCalledTimes(2);
  expect(requests.map(request => request.question)).toEqual(['Pending']);
});

it('drops a pending linked question when chat closes during startup', async () => {
  const { transport, requests } = createTestChat({
    answer: () => ({
      text: 'Unexpected.',
    }),
  });
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
  const { chat } = createTestChat({
    answer: () => ({
      text: 'See the guide.',
      sources: [
        { url: '/docs/guides/zoom', title: 'Zoom guide' },
        { url: 'https://example.org/zoom', title: 'Elsewhere' },
      ],
    }),
  });
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

it.each([390, 1440])(
  'keeps chat usable when a source fails at %i px',
  async width => {
    await page.viewport(width, 900);
    try {
      const { chat } = createTestChat({
        answer: () => ({
          text: 'See the guide.',
          sources: [{ url: '/docs/guide', title: 'Guide' }],
        }),
      });
      await render(
        <Docspot
          chat={chat}
          navigate={async () => {
            throw new Error('Navigation failed');
          }}
        />
      );
      await openChat();
      await userEvent.keyboard('Where is the guide?{Enter}');
      await answers().getByRole('link', { name: 'Guide', exact: true }).click();
      await expect.element(panel()).toBeVisible();
      await composer().click();
      await userEvent.keyboard('Another question');
      await expect.element(composer()).toHaveValue('Another question');
    } finally {
      await page.viewport(1440, 900);
    }
  }
);

it('keeps the draft when starting a new chat', async () => {
  const { chat } = createTestChat({
    answer: ({ question }) => ({
      text: `About ${question}.`,
    }),
  });
  await render(<Docspot chat={chat} />);
  await openChat();
  await userEvent.keyboard('Alpha{Enter}');
  await expect.element(answers().getByText('About Alpha.')).toBeVisible();
  await userEvent.keyboard('Meant for a new chat');
  await panel().getByRole('button', { name: 'New chat' }).click();
  await expect.element(answers()).not.toBeInTheDocument();
  await expect.element(composer()).toHaveValue('Meant for a new chat');
});

it('keeps a later answer in place after jumping to the latest one', async () => {
  const { chat, nextRequest } = createTestChat();
  await render(<Docspot chat={chat} />);
  await openChat();
  await userEvent.keyboard('First{Enter}');
  const first = await nextRequest();
  first.text('Start.\n\n');
  for (let k = 0; k < 6; k++) first.text(`Paragraph ${k}.\n\n`);
  await expect.element(answers().first()).toHaveTextContent('Paragraph 5');
  await commands.wheel('log', 'Chat', -150);
  for (let k = 6; k < 50; k++) first.text(`Paragraph ${k}.\n\n`);
  first.text('The very end.');
  first.end();
  await expect.element(answers().first()).toHaveTextContent('The very end.');
  await panel().getByRole('button', { name: 'Jump to latest answer' }).click();

  await composer().click();
  await userEvent.keyboard('Second{Enter}');
  const reply = await nextRequest();
  reply.text('Short second');
  const second = answers().nth(1);
  await expect.element(second).toHaveTextContent('Short second');
  const top = () => Math.round(second.element().getBoundingClientRect().top);
  const during = top();
  reply.text(' answer.');
  reply.end();
  await expect
    .element(panel().getByRole('button', { name: 'Copy answer' }).nth(1))
    .toBeInTheDocument();
  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);
  // Finishing doesn't move the answer from where reading started.
  expect(top()).toBe(during);
});

it('covers the page on a phone until the page a source opens shows', async () => {
  await page.viewport(390, 800);
  try {
    const { chat } = createTestChat({
      answer: () => ({
        text: 'See the guide.',
        sources: [{ url: '/docs/guides/zoom', title: 'Zoom guide' }],
      }),
    });
    const navigations: Array<() => void> = [];
    const navigate = () =>
      new Promise<void>(resolve => navigations.push(resolve));
    await render(<Docspot chat={chat} navigate={navigate} />);
    await openChat();
    await userEvent.keyboard('Where is zoom?{Enter}');
    await answers().getByRole('link', { name: 'Zoom guide' }).click();
    // The full-screen panel stays over the page being left.
    await expect.element(panel()).toBeVisible();
    navigations[0]?.();
    await expect.element(panel()).not.toBeInTheDocument();
  } finally {
    await page.viewport(1440, 900);
  }
});

it('says when an answer was stopped, and offers to retry it', async () => {
  // The first two answers never finish; the reader stops them.
  const { chat, requests, nextRequest } = createTestChat({
    answer: ({ index }) => (index < 2 ? undefined : 'Full answer.'),
  });
  await render(<Docspot chat={chat} />);
  await openChat();
  const log = () => panel().getByRole('log');
  const announcement = () =>
    panel()
      .getByRole('status')
      .filter({ hasText: /^Answer / });

  // Stopped before any text: the question waits with a way to retry it.
  await userEvent.keyboard('What is the margin?{Enter}');
  (await nextRequest()).tool('searchDocs', { query: 'zoom margin' });
  await expect
    .element(panel().getByText('Searching for “zoom margin”'))
    .toBeVisible();
  await panel().getByRole('button', { name: 'Stop response' }).click();
  await expect
    .element(log().getByText('Stopped', { exact: true }))
    .toBeVisible();
  await expect.element(announcement()).toHaveTextContent('Answer stopped');
  await log().getByRole('button', { name: 'Try again' }).click();

  // Stopped part-way: the answer says so rather than looking complete.
  (await nextRequest()).text('Partial answer');
  await expect.element(answers().getByText('Partial answer')).toBeVisible();
  await panel().getByRole('button', { name: 'Stop response' }).click();
  await expect
    .element(answers().getByText('Stopped', { exact: true }))
    .toBeVisible();
  await expect.element(announcement()).toHaveTextContent('Answer stopped');
  await panel().getByRole('button', { name: 'Retry answer' }).click();
  await expect.element(answers().getByText('Full answer.')).toBeVisible();
  await expect
    .element(answers().getByText('Stopped', { exact: true }))
    .not.toBeInTheDocument();
  await expect.element(announcement()).toHaveTextContent('Answer ready');
  expect(requests[2]?.question).toBe('What is the margin?');
});

it('offers to jump only when more of the answer is below', async () => {
  const { chat } = createTestChat({
    answer: () => ({ text: ['A short answer.', ' It fits.'] }),
  });
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
  const { chat, nextRequest } = createTestChat();
  await render(<Docspot chat={chat} />);
  await openChat();
  await userEvent.keyboard('Tell me everything{Enter}');
  const reply = await nextRequest();
  const paragraphs = (from: number, to: number) => {
    for (let index = from; index <= to; index++)
      reply.text(`Paragraph ${index} about querying data.\n\n`);
  };
  reply.text('Start reading here.\n\n');
  paragraphs(0, 5);
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
  paragraphs(6, 30);
  await expect.element(answer).toHaveTextContent('Paragraph 30');
  expect(
    Math.abs(answer.element().getBoundingClientRect().top - top)
  ).toBeLessThan(2);

  paragraphs(31, 59);
  reply.text('The very end.');
  reply.end();
  await expect.element(answer).toHaveTextContent('The very end.');
  await panel().getByRole('button', { name: 'Jump to latest answer' }).click();
  await expect.element(answer.getByText('The very end.')).toBeInViewport();
});

it('renders tool calls with their renderers, and continues once the reader answers one', async () => {
  type Option = { name: string; defaultValue: string };
  const { chat, requests, nextRequest } = createTestChat({
    answer: ({ index }) =>
      index === 0
        ? undefined
        : index === 1
          ? // Waits for the reader's answer.
            { tools: [{ name: 'confirmReset', input: { option: 'port' } }] }
          : 'Reset to 3000.',
    tools: {
      showOption: ({
        state,
        output,
      }: DocspotToolProps<{ name: string }, Option>) =>
        state === 'output-available' && output ? (
          <p>{`${output.name} defaults to ${output.defaultValue}`}</p>
        ) : (
          <p>Looking up the option</p>
        ),
      confirmReset: ({
        state,
        addOutput,
      }: DocspotToolProps<unknown, boolean>) =>
        state === 'input-available' ? (
          <button type="button" onClick={() => addOutput(true)}>
            Reset the port
          </button>
        ) : (
          <p>Confirmed</p>
        ),
    },
  });
  await render(<Docspot chat={chat} />);
  await openChat();
  await userEvent.keyboard('How do I change the port?{Enter}');
  // The renderer follows the call from its input to its output.
  const reply = await nextRequest();
  const lookup = reply.tool('showOption', { name: 'port' });
  await expect
    .element(answers().first().getByText('Looking up the option'))
    .toBeVisible();
  // The renderer shows the tool's progress, so the generic line doesn't.
  expect(panel().element().textContent).not.toContain('Thinking');
  lookup.output({ name: 'port', defaultValue: '3000' });
  reply.text('Change it in acme.json.');
  reply.end();
  await expect
    .element(answers().first().getByText('port defaults to 3000'))
    .toBeVisible();
  await expect
    .element(answers().first().getByText('Change it in acme.json.'))
    .toBeVisible();

  await expect
    .element(panel().getByRole('button', { name: 'Copy answer' }))
    .toBeInTheDocument();

  await userEvent.keyboard('Reset it{Enter}');
  await answers()
    .nth(1)
    .getByRole('button', { name: 'Reset the port' })
    .click();
  await expect.element(answers().nth(1).getByText('Confirmed')).toBeVisible();
  await expect
    .element(answers().nth(1).getByText('Reset to 3000.'))
    .toBeVisible();
  // The reply continues the same answer rather than starting another.
  await expect.element(answers()).toHaveLength(2);
  // The reader's answer reaches the agent with the conversation.
  const sent = JSON.stringify(requests.at(-1)?.messages.at(-1));
  expect(sent).toContain('"output":true');
});

it('shows tools without a renderer only as progress', async () => {
  const { chat } = createTestChat({
    answer: () => ({
      tools: [{ name: 'lookup', input: { q: 'port' }, output: { hits: 2 } }],
      text: 'Found it.',
    }),
  });
  await render(<Docspot chat={chat} />);
  await openChat();
  await userEvent.keyboard('Where is the port?{Enter}');
  await expect.element(answers().getByText('Found it.')).toBeVisible();
  expect(answers().element().textContent).not.toContain('hits');
});

it('shows a search for the question as asked as thinking', async () => {
  const { chat, nextRequest } = createTestChat();
  await render(<Docspot chat={chat} />);
  await openChat();
  await userEvent.keyboard('How do I change the port?{Enter}');
  const reply = await nextRequest();
  const search = reply.tool('searchDocs', {
    query: 'How do I change the port?',
  });
  await expect
    .element(panel().getByRole('status').getByText('Thinking'))
    .toBeInTheDocument();
  expect(panel().element().textContent).not.toContain('Searching for');
  search.output({ hits: 3 });
  reply.text('Set port in acme.json.');
  reply.end();
  await expect
    .element(answers().getByText('Set port in acme.json.'))
    .toBeVisible();
});

it('draws the attached page with the site’s icon for it', async () => {
  const { chat } = createTestChat({ answer: () => ({ text: 'Answer.' }) });
  const pageIcon = ({
    page,
    size,
  }: DocspotIconProps & { page: DocspotPage }) => (
    <svg data-page-icon={page.url} width={size} height={size} />
  );
  await render(
    <Docspot chat={chat} context={{ page: guide }} slots={{ pageIcon }} />
  );
  await openChat();
  const chip = panel().getByText('Zoom guide');
  await expect.element(chip).toBeVisible();
  expect(
    panel().element().querySelector(`[data-page-icon="${guide.url}"]`)
  ).not.toBeNull();
});
