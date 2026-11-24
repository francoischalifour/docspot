import { expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { Docspot, type DocspotLocale, type DocspotSearchParams } from '@/index';
import * as entry from '@/locale';
import { pluralize } from '@/locale';
import { results } from '@test/fixtures';
import { createTestChat } from '@test/testing';

/** Every locale `docspot/locale` exports, by name, without its helpers. */
const locales = Object.fromEntries(
  Object.entries(entry).filter(
    (pair): pair is [string, DocspotLocale] => typeof pair[1] === 'object'
  )
);

const panel = (name: string) => page.getByRole('complementary', { name });

it('shows the interface in the locale’s language', async () => {
  const { chat } = createTestChat({ answer: () => ({ text: 'Réponse.' }) });
  await render(
    <Docspot search={() => results} chat={chat} locale={entry.fr} />
  );
  await page.getByRole('button', { name: 'Rechercher ou demander' }).click();
  const dialog = page.getByRole('dialog', {
    name: 'Rechercher dans la documentation',
  });
  await expect.element(dialog).toBeVisible();
  await expect
    .element(dialog.getByRole('combobox'))
    .toHaveAttribute('placeholder', 'Rechercher ou demander…');
  await userEvent.keyboard('Comment exporter ?{Tab}');
  await expect
    .element(
      panel('Demander à l’IA').getByRole('button', {
        name: 'Masquer le panneau de l’IA',
      })
    )
    .toBeInTheDocument();
});

it('renames the assistant everywhere it is named', async () => {
  const { chat } = createTestChat({ answer: () => ({ text: 'Hi.' }) });
  await render(<Docspot chat={chat} messages={{ assistant: 'Acme' }} />);
  await page.getByRole('button', { name: 'Ask Acme' }).click();
  await expect
    .element(panel('Ask Acme').getByRole('button', { name: 'Hide Ask Acme' }))
    .toBeInTheDocument();
  await expect
    .element(panel('Ask Acme').getByRole('textbox', { name: 'Ask Acme' }))
    .toHaveFocus();
});

it('applies the site’s text over a locale, keeping the rest of it', async () => {
  const { chat } = createTestChat({ answer: () => ({ text: 'Réponse.' }) });
  await render(
    <Docspot
      chat={chat}
      locale={entry.fr}
      messages={{ assistant: 'Kapa', chat: { newChat: 'Nouveau fil' } }}
    />
  );
  await page.getByRole('button', { name: 'Demander à Kapa' }).click();
  const chatPanel = panel('Demander à Kapa');
  await expect
    .element(chatPanel.getByRole('button', { name: 'Nouveau fil' }))
    .toBeInTheDocument();
  await expect
    .element(
      chatPanel.getByText('Posez vos questions à Kapa sur cette documentation')
    )
    .toBeVisible();
});

it('formats times in the locale’s language', async () => {
  const { chat } = createTestChat({ answer: () => ({ text: 'Réponse.' }) });
  await render(<Docspot chat={chat} locale={entry.fr} />);
  await page.getByRole('button', { name: 'Demander à l’IA' }).click();
  await userEvent.keyboard('Bonjour{Enter}');
  const chatPanel = panel('Demander à l’IA');
  await expect
    .element(chatPanel.getByRole('button', { name: 'Copier la réponse' }))
    .toBeInTheDocument();
  const time = chatPanel.element().querySelector('time');
  expect(time?.title).toMatch(
    /lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche/
  );
});

const modifier = navigator.platform.includes('Mac') ? 'Meta' : 'Control';

it('counts results with the locale’s plural rules', async () => {
  await render(
    <Docspot
      search={({ query }) => results.slice(0, query.length - 1)}
      locale={entry.fr}
    />
  );
  await page.getByRole('button', { name: 'Rechercher dans la doc' }).click();
  const status = page
    .getByRole('dialog')
    .getByRole('status')
    .filter({ hasText: 'résultat' });
  // French counts 0 and 1 in the singular.
  await userEvent.keyboard('ab');
  await expect.element(status).toHaveTextContent('1 résultat');
  await userEvent.keyboard('c');
  await expect.element(status).toHaveTextContent('2 résultats');
});

it('picks each plural category a language has, else `other`', () => {
  const polish = {
    one: 'wynik',
    few: 'wyniki',
    many: 'wyników',
    other: 'wyniku',
  };
  expect(pluralize(1, polish, 'pl')).toBe('wynik');
  expect(pluralize(3, polish, 'pl')).toBe('wyniki');
  expect(pluralize(5, polish, 'pl')).toBe('wyników');
  expect(pluralize(1.5, polish, 'pl')).toBe('wyniku');
  expect(pluralize(0, { one: 'page', other: 'pages' }, 'en')).toBe('pages');
  expect(pluralize(0, { one: 'page', other: 'pages' }, 'fr')).toBe('page');
  // Arabic has a form for two; without one, `other` is used.
  expect(pluralize(2, { two: 'صفحتان', other: 'صفحات' }, 'ar')).toBe('صفحتان');
  expect(pluralize(2, { other: 'صفحات' }, 'ar')).toBe('صفحات');
});

it.each(Object.entries(locales))(
  'fills every placeholder in %s',
  async (_name, locale) => {
    const { chat } = createTestChat({ answer: () => ({ text: 'OK.' }) });
    await render(<Docspot search={() => []} chat={chat} locale={locale} />);
    const placeholder = /\{\w+\}/;
    expect(document.body.innerHTML).not.toMatch(placeholder);
    await userEvent.keyboard(`{${modifier}>}k{/${modifier}}`);
    const dialog = page.getByRole('dialog');
    await expect.element(dialog).toBeVisible();
    await userEvent.keyboard('nothing matches this');
    await expect.element(dialog.getByRole('status')).toBeInTheDocument();
    expect(dialog.element().outerHTML).not.toMatch(placeholder);
    await userEvent.keyboard('{Tab}');
    await expect
      .element(page.getByRole('complementary').getByRole('textbox'))
      .toHaveFocus();
    expect(document.body.innerHTML).not.toMatch(placeholder);
  }
);

it.each([
  ['zhCN', entry.zhCN, '切换主题', '主题'],
  ['ja', entry.ja, 'テーマを切り替える', 'テーマ'],
])(
  'finds items by a word inside their title in %s, written without spaces',
  async (_name, locale, title, typed) => {
    const item = { id: 'theme', title, action: () => {} };
    await render(<Docspot search={() => []} items={[item]} locale={locale} />);
    await userEvent.keyboard(`{${modifier}>}k{/${modifier}}`);
    await expect.element(page.getByRole('dialog')).toBeVisible();
    await userEvent.keyboard(typed);
    await expect
      .element(page.getByRole('option', { name: new RegExp(title) }))
      .toBeVisible();
  }
);

it('tells the search function the interface’s language and its question words', async () => {
  const calls: DocspotSearchParams[] = [];
  await render(
    <Docspot
      search={params => {
        calls.push(params);
        return [];
      }}
      locale={entry.de}
    />
  );
  await userEvent.keyboard(`{${modifier}>}k{/${modifier}}`);
  await userEvent.keyboard('Paket');
  await vi.waitFor(() => expect(calls.at(-1)?.query).toBe('Paket'));
  expect(calls.at(-1)?.locale).toEqual({
    code: 'de',
    questions: entry.de.questions,
  });
});

it('labels keys as the locale’s keyboards do', async () => {
  await render(<Docspot search={() => []} locale={entry.de} />);
  const trigger = page.getByRole('button', { name: 'Doku durchsuchen' });
  const isApple = navigator.platform.includes('Mac');
  await expect.element(trigger).toHaveTextContent(isApple ? '⌘K' : 'StrgK');
  await trigger.click();
  await expect.element(page.getByRole('dialog')).toBeVisible();
  // The footer's hint for closing search names the Escape key.
  const footer = page.getByRole('dialog').getByText('zum Schließen');
  await expect.element(footer).toBeVisible();
  expect(footer.element().parentElement?.textContent).toContain('Esc');
});

it('names Escape as French keyboards do', async () => {
  await render(<Docspot search={() => []} locale={entry.fr} />);
  await page.getByRole('button', { name: 'Rechercher dans la doc' }).click();
  const hint = page.getByRole('dialog').getByText('pour fermer');
  await expect.element(hint).toBeVisible();
  expect(hint.element().parentElement?.textContent).toContain('Échap');
});

/**
 * Text a locale may share with English because it is the same word there,
 * by locale and key. Everything else must be translated.
 */
const sameAsEnglish: Record<string, string[]> = {
  de: ['chat.conversation'],
  es: ['chat.conversation'],
  fr: [
    'search.documentation',
    'search.actions',
    'chat.sources',
    'chat.sourceFallback',
    'chat.pixels',
  ],
  ja: ['assistant'],
  zhCN: ['assistant', 'search.quotedQuery'],
};

/** A locale's text by key, functions called with a sample of what they take. */
function flatten(locale: DocspotLocale) {
  const numeric = new Set(['resultCount', 'pixels']);
  const text = new Map<string, string>();
  const { assistant, ...groups } = locale.messages;
  text.set('assistant', assistant);
  for (const [group, values] of Object.entries(groups))
    for (const [key, value] of Object.entries(values)) {
      const sample = numeric.has(key) ? 2 : 'Zoom';
      text.set(
        `${group}.${key}`,
        typeof value === 'function'
          ? (value as (sample: unknown) => string)(sample)
          : value
      );
    }
  return text;
}

it.each(Object.entries(locales).filter(([name]) => name !== 'en'))(
  'translates every text in %s',
  (name, locale) => {
    const english = flatten(entry.en);
    const untranslated = [...flatten(locale)]
      .filter(
        ([key, text]) =>
          text !== '' &&
          text === english.get(key) &&
          // Keycaps read the same in most languages.
          !key.startsWith('keys.') &&
          !sameAsEnglish[name]?.includes(key)
      )
      .map(([key, text]) => `${key}: ${text}`);
    expect(untranslated).toEqual([]);
  }
);

/**
 * Elements that reach past the viewport's sides, skipping text an ancestor
 * clips on purpose, such as a title cut with an ellipsis.
 */
function overflowing(container: Element) {
  const width = document.documentElement.clientWidth;
  return [...container.querySelectorAll<HTMLElement>('*')]
    .filter(element => {
      const { left, right, width: size } = element.getBoundingClientRect();
      if (!size || (left >= -1 && right <= width + 1)) return false;
      for (
        let parent = element.parentElement;
        parent;
        parent = parent.parentElement
      ) {
        if (parent === container) break;
        if (getComputedStyle(parent).overflowX !== 'visible') return false;
      }
      return true;
    })
    .map(
      element =>
        `${element.className || element.tagName}: ${element.textContent.slice(0, 40)}`
    );
}

it.each(Object.entries(locales))(
  'fits every text of %s on a phone',
  async (_name, locale) => {
    await page.viewport(360, 740);
    try {
      const backend = createTestChat({ answer: () => 'OK.' });
      await render(
        <header style={{ display: 'flex', gap: 8 }}>
          <Docspot
            search={() => results}
            chat={backend.chat}
            locale={locale}
            context={{
              page: { url: '/docs/guides/zoom', title: 'Zoom guide' },
              suggestions: ['How do I zoom?'],
            }}
          >
            <Docspot.ChatTrigger />
          </Docspot>
        </header>
      );
      expect(overflowing(document.body)).toEqual([]);
      await userEvent.keyboard(`{${modifier}>}k{/${modifier}}`);
      const dialog = page.getByRole('dialog');
      await userEvent.keyboard('nothing at all here');
      await expect.element(dialog.getByRole('status')).toBeInTheDocument();
      expect(overflowing(dialog.element())).toEqual([]);
      await userEvent.keyboard('{Tab}');
      const chat = page.getByRole('complementary');
      await expect.element(chat.getByRole('textbox')).toHaveFocus();
      expect(overflowing(chat.element())).toEqual([]);
      expect(document.scrollingElement!.scrollWidth).toBeLessThanOrEqual(
        document.documentElement.clientWidth
      );
    } finally {
      await page.viewport(1440, 900);
    }
  }
);
