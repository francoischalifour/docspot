import { expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { Docspot, type DocspotTooltipProps } from '@/index';
import { createChatServer } from '@test/fixtures';

const modifier = navigator.platform.includes('Mac') ? 'Meta' : 'Control';
const panel = () => page.getByRole('complementary', { name: 'Ask AI' });

async function chatWithAnswer() {
  const { chat } = createChatServer(question => ({
    text: `About ${question}.`,
  }));
  await render(<Docspot chat={chat} history />);
  await userEvent.keyboard(`{${modifier}>}j{/${modifier}}`);
  await expect.element(panel().getByRole('textbox')).toHaveFocus();
  await userEvent.keyboard('Alpha{Enter}');
  await expect.element(panel().getByText('About Alpha.')).toBeVisible();
}

function isInsideViewport(element: Element) {
  const rect = element.getBoundingClientRect();
  return (
    rect.width > 0 &&
    rect.left >= 0 &&
    rect.top >= 0 &&
    rect.right <= document.documentElement.clientWidth &&
    rect.bottom <= document.documentElement.clientHeight
  );
}

it('shows tooltips above every panel, inside the viewport, beside their button', async () => {
  await chatWithAnswer();
  // At the window's edge, where a centered tooltip would overflow it.
  const hide = panel().getByRole('button', { name: 'Hide Ask AI' });
  await hide.hover();
  const tooltip = page.getByText('Hide Ask AI');
  await expect.element(tooltip).toBeVisible();
  const tip = tooltip.element();
  // In the top layer, so the panel's edges can't cut it.
  expect(tip.matches(':popover-open')).toBe(true);
  expect(isInsideViewport(tip)).toBe(true);
  const button = hide.element().getBoundingClientRect();
  const rect = tip.getBoundingClientRect();
  expect(rect.top).toBeGreaterThanOrEqual(button.bottom);
  expect(rect.top - button.bottom).toBeLessThan(12);

  // Leaving hides it; keyboard focus shows it too.
  await page.getByRole('complementary').getByRole('log').hover();
  await expect.element(tooltip).not.toBeVisible();
  hide.element().focus();
  await userEvent.keyboard('{Shift>}{Tab}{/Shift}{Tab}');
  await expect.element(tooltip).toBeVisible();
});

it('keeps an open menu beside its button as the window resizes', async () => {
  await chatWithAnswer();
  await panel()
    .getByRole('button', { name: /Switch chat/ })
    .click();
  const menu = page.getByRole('menu');
  await expect.element(menu).toBeVisible();
  const gap = () => {
    const button = panel()
      .getByRole('button', { name: /Switch chat/ })
      .element()
      .getBoundingClientRect();
    const rect = menu.element().getBoundingClientRect();
    return { x: rect.left - button.left, y: rect.top - button.bottom };
  };
  const before = gap();
  await page.viewport(1000, 700);
  try {
    await vi.waitFor(() => expect(gap()).toEqual(before));
    expect(isInsideViewport(menu.element())).toBe(true);
  } finally {
    await page.viewport(1440, 900);
  }
});

it('draws a site’s own tooltips around Docspot’s buttons', async () => {
  const seen: Array<Pick<DocspotTooltipProps, 'label' | 'side'>> = [];
  function SiteTooltip({ label, side, children }: DocspotTooltipProps) {
    seen.push({ label, side });
    return <span data-site-tooltip={label}>{children}</span>;
  }
  const { chat } = createChatServer(() => ({ text: 'Answer.' }));
  await render(<Docspot chat={chat} slots={{ tooltip: SiteTooltip }} />);
  await userEvent.keyboard(`{${modifier}>}j{/${modifier}}`);
  // Once chat has started, past the startup panel's own Hide button.
  await expect.element(panel().getByRole('textbox')).toHaveFocus();
  const hide = panel().getByRole('button', { name: 'Hide Ask AI' });
  await expect.element(hide).toBeVisible();
  expect(hide.element().parentElement?.dataset.siteTooltip).toBe('Hide Ask AI');
  expect(seen).toContainEqual({ label: 'Hide Ask AI', side: 'bottom' });
  // Docspot draws none of its own.
  expect(document.querySelector('.docspot-tooltip')).toBeNull();
});
