import { afterEach, expect, it } from 'vitest';
import { commands, page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { Docspot } from '@/index';
import { createChatServer, results } from '@test/fixtures';

const root = document.documentElement;
const searchInput = () =>
  page.getByRole('combobox', { name: 'Search documentation' });

afterEach(async () => {
  await commands.emulateMedia({
    forcedColors: null,
    contrast: null,
    media: null,
  });
  root.removeAttribute('dir');
});

it('reads key combinations left to right in right-to-left pages', async () => {
  root.dir = 'rtl';
  await render(<Docspot search={() => results} />);
  const keys = page
    .getByRole('button', { name: 'Search docs' })
    .element()
    .querySelectorAll('kbd span');
  const [modifier, letter] = [...keys].map(key => key.getBoundingClientRect());
  expect(modifier!.left).toBeLessThan(letter!.left);
});

it('marks only the selected result in forced colors', async () => {
  await commands.emulateMedia({ forcedColors: 'active' });
  await render(<Docspot search={() => results} />);
  await page.getByRole('button', { name: 'Search docs' }).click();
  await expect.element(searchInput()).toHaveFocus();
  await userEvent.keyboard('product');
  const selected = page.getByRole('option', { selected: true }).element();
  const other = page.getByRole('option', { selected: false }).first().element();
  const border = (element: Element) => getComputedStyle(element).borderColor;
  expect(border(selected)).not.toBe(border(other));
  // Unselected results draw no visible border: it matches the background.
  expect(border(other)).toBe(
    getComputedStyle(other.closest('dialog')!).backgroundColor
  );
});

it('leaves search, chat, and their room out of printed pages', async () => {
  const { chat } = createChatServer(() => ({ text: 'Answer.' }));
  await render(<Docspot search={() => results} chat={chat} />);
  await page.getByRole('button', { name: 'Search or ask docs' }).click();
  await userEvent.keyboard('Question{Tab}');
  const panel = page.getByRole('complementary', { name: 'Ask AI' });
  await expect.element(panel).toBeVisible();
  expect(
    getComputedStyle(root).getPropertyValue('--docspot-chat-inset')
  ).not.toBe('');

  const panelElement = panel.element();
  const trigger = page
    .getByRole('button', { name: 'Search or ask docs' })
    .element();

  await commands.emulateMedia({ media: 'print' });
  expect(panelElement.checkVisibility()).toBe(false);
  expect(trigger.checkVisibility()).toBe(false);
  expect(
    getComputedStyle(root).getPropertyValue('--docspot-chat-inset').trim()
  ).toBe('0px');
});

it('strengthens secondary text when the reader asks for more contrast', async () => {
  const sample = document.createElement('p');
  sample.style.color = 'var(--docspot-muted)';
  document.body.append(sample);
  const lightness = () =>
    getComputedStyle(sample)
      .color.match(/[\d.]+/g)!
      .slice(0, 3)
      .map(Number)
      .reduce((sum, channel) => sum + channel, 0);
  try {
    const usual = lightness();
    await commands.emulateMedia({ contrast: 'more' });
    // Closer to the light palette's near-black text.
    expect(lightness()).toBeLessThan(usual);
  } finally {
    sample.remove();
  }
});
