import { expect, it } from 'vitest';
import { commands, page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { Docspot } from '@/index';
import { createChatServer } from '@test/fixtures';

declare module 'vitest/browser' {
  interface BrowserCommands {
    dragBy: (
      role: 'separator',
      name: string,
      deltaX: number,
      options?: { steps?: number }
    ) => Promise<void>;
  }
}

const panel = () => page.getByRole('complementary', { name: 'Ask AI' });
const handle = () => page.getByRole('separator', { name: 'Resize Ask AI' });
const chatWidth = () =>
  document.documentElement.style.getPropertyValue('--docspot-chat-width');

async function openDockedChat() {
  const { chat } = createChatServer(() => ({ text: 'Answer.' }));
  await render(<Docspot chat={chat} />);
  await page.getByRole('button', { name: 'Ask AI' }).first().click();
  await expect.element(panel().getByRole('textbox')).toHaveFocus();
}

it('resizes the docked panel with the keyboard, and resets it', async () => {
  await openDockedChat();
  await expect.element(handle()).toHaveAttribute('aria-valuenow', '400');
  handle().element().focus();
  // Repeated presses each build on the last, as when a key is held.
  await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
  await expect.element(handle()).toHaveAttribute('aria-valuenow', '432');
  expect(chatWidth()).toBe('432px');
  await userEvent.keyboard('{End}');
  await expect.element(handle()).toHaveAttribute('aria-valuenow', '640');
  await userEvent.keyboard('{Home}');
  await expect.element(handle()).toHaveAttribute('aria-valuenow', '320');
  await userEvent.dblClick(handle());
  await expect.element(handle()).toHaveAttribute('aria-valuenow', '400');
  expect(chatWidth()).toBe('');
});

it('hides the panel with the keyboard from its minimum width', async () => {
  await openDockedChat();
  handle().element().focus();
  await userEvent.keyboard('{Home}');
  await expect.element(handle()).toHaveAttribute('aria-valuenow', '320');
  await userEvent.keyboard('{ArrowRight}');
  await expect
    .element(page.getByRole('button', { name: 'Ask AI' }).first())
    .toHaveAttribute('aria-expanded', 'false');
});

it('resizes by dragging, and hides when dragged far past its minimum', async () => {
  await openDockedChat();
  await commands.dragBy('separator', 'Resize Ask AI', -100);
  await expect.element(handle()).toHaveAttribute('aria-valuenow', '500');
  expect(chatWidth()).toBe('500px');

  // A short drag past the minimum width slides back to it.
  await commands.dragBy('separator', 'Resize Ask AI', 200, { steps: 20 });
  await expect.element(handle()).toHaveAttribute('aria-valuenow', '320');
  await expect.element(panel()).toHaveStyle({ transform: 'none' });

  await commands.dragBy('separator', 'Resize Ask AI', 120, { steps: 20 });
  await expect
    .element(page.getByRole('button', { name: 'Ask AI' }).first())
    .toHaveAttribute('aria-expanded', 'false');
});
