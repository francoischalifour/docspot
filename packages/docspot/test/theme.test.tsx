import type { ReactNode } from 'react';
import { afterEach, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { Docspot } from '@/index';
import { createChatServer, results } from '@test/fixtures';

const DARK_BACKGROUND = 'rgb(17, 17, 19)';
const LIGHT_BACKGROUND = 'rgb(255, 255, 255)';
const root = document.documentElement;

afterEach(() => {
  root.classList.remove('dark');
});

async function openSearch(wrap: (children: ReactNode) => ReactNode) {
  await render(wrap(<Docspot search={() => results} />));
  await page.getByRole('button', { name: 'Search docs' }).click();
  const dialog = page.getByRole('dialog', { name: 'Search documentation' });
  await expect.element(dialog).toBeVisible();
  return dialog.element();
}

it('draws native parts, such as scrollbars, in the palette’s scheme', async () => {
  root.classList.add('dark');
  const dialog = await openSearch(children => children);
  expect(getComputedStyle(dialog).colorScheme).toBe('dark');
  expect(getComputedStyle(dialog).backgroundColor).toBe(DARK_BACKGROUND);
});

it('follows a theme set on a section of the page', async () => {
  const dialog = await openSearch(children => (
    <section data-theme="dark">{children}</section>
  ));
  expect(getComputedStyle(dialog).backgroundColor).toBe(DARK_BACKGROUND);
  expect(getComputedStyle(dialog).colorScheme).toBe('dark');
});

it('keeps a light section light inside a dark page, selection included', async () => {
  root.classList.add('dark');
  const dialog = await openSearch(children => (
    <section className="light">{children}</section>
  ));
  expect(getComputedStyle(dialog).backgroundColor).toBe(LIGHT_BACKGROUND);
  expect(getComputedStyle(dialog).colorScheme).toBe('light');
  await userEvent.keyboard('product');
  // The dark palette's selection color does not leak into the light section.
  await expect
    .element(page.getByRole('option', { selected: true }))
    .toHaveStyle({ backgroundColor: LIGHT_BACKGROUND });
});

it('draws every icon with the same stroke, whatever its size', async () => {
  const { chat } = createChatServer(() => ({
    text: 'See the guide.',
    sources: [{ url: '/docs/guides/zoom', title: 'Zoom guide' }],
  }));
  await render(
    <Docspot
      search={() => results}
      chat={chat}
      context={{ page: { url: '/docs', title: 'Docs' } }}
    />
  );
  const strokes = new Map<string, number>();
  function measure() {
    for (const icon of document.querySelectorAll<SVGSVGElement>(
      'svg[stroke="currentColor"]'
    )) {
      const width = icon.getBoundingClientRect().width;
      if (!width) continue;
      // As drawn, CSS included: the stroke scales with the icon's size.
      const drawn =
        (parseFloat(getComputedStyle(icon).strokeWidth) * width) /
        icon.viewBox.baseVal.width;
      strokes.set(`${width}px`, Math.round(drawn * 100) / 100);
    }
  }
  await page.getByRole('button', { name: 'Search or ask docs' }).click();
  await userEvent.keyboard('http');
  await expect.element(page.getByRole('option').first()).toBeVisible();
  measure();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect.element(page.getByRole('dialog')).not.toBeInTheDocument();
  const modifier = navigator.platform.includes('Mac') ? 'Meta' : 'Control';
  await userEvent.keyboard(`{${modifier}>}j{/${modifier}}`);
  await expect
    .element(page.getByRole('complementary').getByRole('textbox'))
    .toHaveFocus();
  await userEvent.keyboard('Where is zoom?{Enter}');
  await expect
    .element(page.getByRole('button', { name: 'Copy answer' }))
    .toBeInTheDocument();
  await page.getByRole('button', { name: /Switch chat/ }).click();
  measure();
  // Icons from 12px to 22px, all drawn at the same weight.
  expect(strokes.size).toBeGreaterThanOrEqual(3);
  expect(new Set(strokes.values())).toEqual(new Set([1.3]));
});
