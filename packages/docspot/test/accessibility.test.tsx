// Automated checks with axe-core, at each state a reader reaches, in both
// palettes and in a locale with longer text. These catch what role and name
// queries don't: contrast, ARIA misuse, missing labels, and landmarks. They
// don't judge forced colors or what a screen reader says, which other tests
// cover.
import axe from 'axe-core';
import { afterEach, describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import {
  Docspot,
  type DocspotLocale,
  type DocspotPreviewProps,
  type DocspotSearch,
  defineItem,
} from '@/index';
import { ar, de, en } from '@/locale';
import { results } from '@test/fixtures';
import { createTestChat } from '@test/testing';

const modifier = navigator.platform.includes('Mac') ? 'Meta' : 'Control';
const root = document.documentElement;

afterEach(() => {
  root.classList.remove('dark');
  root.removeAttribute('dir');
});

/** Fails with each violation's rule, help, and the elements it found. */
async function expectNoViolations() {
  // Settles transitions, so colors are measured as the reader sees them.
  await new Promise(resolve => setTimeout(resolve, 250));
  const { violations } = await axe.run(document.body, {
    resultTypes: ['violations'],
  });
  const report = violations.map(
    ({ id, help, nodes }) =>
      `${id}: ${help}\n${nodes
        .map(node => `  ${node.target.join(' ')}: ${node.failureSummary}`)
        .join('\n')}`
  );
  expect(report).toEqual([]);
}

function Preview({ result }: DocspotPreviewProps) {
  return (
    <article>
      <h1>{result.title}</h1>
      <p>{result.excerpt}</p>
    </article>
  );
}

const toggleTheme = defineItem({
  id: 'theme',
  title: 'Toggle theme',
  keywords: ['dark'],
  shortcut: 'Shift+Meta+L',
  action: () => {},
});

type Setting = {
  name: string;
  dark?: boolean;
  locale?: DocspotLocale;
  rtl?: boolean;
};

const settings: Setting[] = [
  { name: 'light' },
  { name: 'dark', dark: true },
  { name: 'German, with longer text', locale: de },
  { name: 'Arabic, right to left', locale: ar, rtl: true },
];

describe.each(settings)('in $name', ({ dark, locale, rtl }) => {
  // Controls are found by the names the locale gives them.
  const messages = (locale ?? en).messages;
  const named = (text: string) =>
    text.replaceAll('{assistant}', messages.assistant);
  async function setUp(search: DocspotSearch = () => results) {
    if (dark) root.classList.add('dark');
    if (rtl) root.dir = 'rtl';
    const backend = createTestChat({
      answer: ({ index }) =>
        index === 0
          ? undefined
          : {
              text: 'Call `zoom()` on the image. See **Options**.',
              sources: [{ url: '/docs/guides/zoom', title: 'Zoom guide' }],
            },
    });
    await render(
      <Docspot
        search={search}
        chat={backend.chat}
        locale={locale}
        history
        items={[toggleTheme]}
        defaultItems={[{ url: '/docs', title: 'Docs', group: 'Popular' }]}
        context={{
          page: { url: '/docs/guides/zoom', title: 'Zoom guide' },
          prompts: ['How do I zoom?'],
        }}
        slots={{ preview: Preview }}
      >
        <Docspot.ChatTrigger />
      </Docspot>
    );
    return backend;
  }

  async function openSearch() {
    await userEvent.keyboard(`{${modifier}>}k{/${modifier}}`);
    await expect.element(page.getByRole('dialog')).toBeVisible();
  }

  async function openChat() {
    await userEvent.keyboard(`{${modifier}>}j{/${modifier}}`);
    await expect
      .element(page.getByRole('complementary').getByRole('textbox'))
      .toHaveFocus();
  }

  it('has no violations at rest, with the triggers', async () => {
    await setUp();
    await expectNoViolations();
  });

  it('has no violations in search before and after typing', async () => {
    await setUp();
    await openSearch();
    await expectNoViolations();
    await userEvent.keyboard('sql');
    await expect.element(page.getByRole('option').first()).toBeVisible();
    await expectNoViolations();
    // Items, with their shortcut, and the ask row selected.
    await userEvent.fill(page.getByRole('combobox'), 'dark');
    await expect.element(page.getByRole('option').first()).toBeVisible();
    await expectNoViolations();
  });

  it('has no violations when search finds nothing or fails', async () => {
    await setUp(({ query }) => {
      if (query === 'broken') throw new Error('Offline');
      return [];
    });
    await openSearch();
    await userEvent.keyboard('nothing');
    await expect
      .element(page.getByRole('dialog').getByRole('status'))
      .toBeInTheDocument();
    await expectNoViolations();
    await userEvent.fill(page.getByRole('combobox'), 'broken');
    await expect.element(page.getByText(messages.search.error)).toBeVisible();
    await expectNoViolations();
  });

  it('has no violations in chat as an answer streams and completes', async () => {
    const { nextRequest } = await setUp();
    await openChat();
    // Welcome, suggested questions, and the attached page.
    await expectNoViolations();
    await userEvent.keyboard('How do I zoom?{Enter}');
    const reply = await nextRequest();
    reply.tool('searchDocs', { query: 'zoom image' });
    await expect
      .element(page.getByRole('complementary').getByRole('status').first())
      .toBeInTheDocument();
    // A tooltip, shown on keyboard focus.
    page
      .getByRole('complementary')
      .getByRole('button', { name: named(messages.chat.stop) })
      .element()
      .focus();
    await expectNoViolations();
    reply.end();
    // A scripted answer, with code, emphasis, sources, and its actions.
    await userEvent.fill(
      page.getByRole('complementary').getByRole('textbox'),
      'And the margin?'
    );
    await userEvent.keyboard('{Enter}');
    await expect
      .element(page.getByRole('complementary').getByRole('link').last())
      .toBeVisible();
    await expectNoViolations();
  });

  it('has no violations in the chat switcher and its confirmation', async () => {
    const { nextRequest } = await setUp();
    await openChat();
    await userEvent.keyboard('How do I zoom?{Enter}');
    const reply = await nextRequest();
    reply.text('Use zoom().');
    reply.end();
    const chat = page.getByRole('complementary');
    await expect.element(chat.getByRole('article')).toBeVisible();
    await chat
      .getByRole('button', { name: messages.chat.switchChat('How do I zoom?') })
      .click();
    const menu = page.getByRole('menu');
    await expect.element(menu).toBeVisible();
    await expectNoViolations();
    await menu
      .getByRole('menuitem', { name: messages.chat.clearHistory })
      .click();
    await expect
      .element(
        menu.getByRole('menuitem', { name: messages.chat.confirmClearHistory })
      )
      .toBeVisible();
    await expectNoViolations();
  });
});
