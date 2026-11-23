import { expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { Docspot, type DocspotLocale } from '@/index';
import * as entry from '@/locale';
import { pluralize } from '@/locale';
import { createChatServer, results } from '@test/fixtures';

/** Every locale `docspot/locale` exports, by name, without its helpers. */
const locales = Object.fromEntries(
  Object.entries(entry).filter(
    (pair): pair is [string, DocspotLocale] => typeof pair[1] === 'object'
  )
);

const panel = (name: string) => page.getByRole('complementary', { name });

it('shows the interface in the locale’s language', async () => {
  const { chat } = createChatServer(() => ({ text: 'Réponse.' }));
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
  const { chat } = createChatServer(() => ({ text: 'Hi.' }));
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
  const { chat } = createChatServer(() => ({ text: 'Réponse.' }));
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
  const { chat } = createChatServer(() => ({ text: 'Réponse.' }));
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
    const { chat } = createChatServer(() => ({ text: 'OK.' }));
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
