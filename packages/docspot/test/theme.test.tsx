import type { ReactNode } from 'react';
import { afterEach, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { Docspot } from '@/index';
import { results } from '@test/fixtures';

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
