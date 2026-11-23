import { expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { Docspot } from '@/index';
import { results } from '@test/fixtures';
import { createTestChat } from '@test/testing';

const modifier = navigator.platform.includes('Mac') ? 'Meta' : 'Control';

// Each test opens a surface before its code has loaded: search first, then
// chat, which the search test never loads.
it('keeps what is typed while the search dialog loads', async () => {
  await render(<Docspot search={() => results} preload={false} />);
  await userEvent.keyboard(`{${modifier}>}k{/${modifier}}httpx{Backspace}`);
  const input = page.getByRole('combobox', { name: 'Search documentation' });
  await expect.element(input).toHaveFocus();
  await expect.element(input).toHaveValue('http');
  await userEvent.keyboard(' api');
  await expect.element(input).toHaveValue('http api');
  await expect
    .element(page.getByRole('option', { name: /HTTP API/ }))
    .toBeVisible();
});

it('keeps what is typed while chat starts', async () => {
  const { chat } = createTestChat({ answer: () => ({ text: 'Hi.' }) });
  await render(<Docspot chat={chat} preload={false} />);
  await userEvent.keyboard(`{${modifier}>}j{/${modifier}}zoom x{Backspace}`);
  const composer = page
    .getByRole('complementary', { name: 'Ask AI' })
    .getByRole('textbox');
  await expect.element(composer).toHaveFocus();
  await expect.element(composer).toHaveValue('zoom ');
  // Typing goes on where it left off.
  await userEvent.keyboard('in');
  await expect.element(composer).toHaveValue('zoom in');
});
