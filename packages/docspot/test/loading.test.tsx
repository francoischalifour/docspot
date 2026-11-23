import { expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { Docspot } from '@/index';
import { results } from '@test/fixtures';

const modifier = navigator.platform.includes('Mac') ? 'Meta' : 'Control';

// The first test in this file opens search before its dialog has loaded.
it('keeps what is typed while the search dialog loads', async () => {
  await render(<Docspot search={() => results} preload={false} />);
  await userEvent.keyboard(`{${modifier}>}k{/${modifier}}httpx{Backspace}`);
  const input = page.getByRole('combobox', { name: 'Search documentation' });
  await expect.element(input).toHaveFocus();
  await expect.element(input).toHaveValue('http');
  await expect
    .element(page.getByRole('option', { name: /HTTP API/ }))
    .toBeVisible();
});
