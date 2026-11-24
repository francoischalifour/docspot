import { expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-react';

import { Docspot, createSearch } from '@/index';
import { results } from '@test/fixtures';
import { createTestChat } from '@test/testing';

const isMac = navigator.platform.includes('Mac');
const modifier = isMac ? 'Meta' : 'Control';
const command = isMac ? '⌘' : 'Ctrl';
const searchInput = () =>
  page.getByRole('combobox', { name: 'Search documentation' });
const searchDialog = () =>
  page.getByRole('dialog', { name: 'Search documentation' });
const panel = () => page.getByRole('complementary', { name: 'Ask AI' });
const composer = () => panel().getByRole('textbox');

/** Presses a key with Ctrl as a layout reports it, such as Russian. */
function pressWithControl(key: string, code: string) {
  document.activeElement?.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      code,
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
  );
}

/** Lets a key press that should do nothing have its chance to. */
const settle = () => new Promise(requestAnimationFrame);

function Surfaces() {
  return (
    <>
      <Docspot.SearchTrigger />
      <Docspot.ChatTrigger />
      <Docspot.ChatLauncher />
      <Docspot.SearchDialog />
      <Docspot.ChatPanel />
    </>
  );
}

it('announces and hints the default shortcuts', async () => {
  const { chat } = createTestChat({ answer: () => ({ text: 'Answer.' }) });
  await render(
    <Docspot.Root search={() => results} chat={chat}>
      <Surfaces />
    </Docspot.Root>
  );
  const searchTrigger = page.getByRole('button', {
    name: 'Search or ask docs',
  });
  await expect
    .element(searchTrigger)
    .toHaveAttribute('aria-keyshortcuts', 'Meta+K Control+K /');
  await expect.element(searchTrigger).toHaveTextContent(`${command}K`);
  const [chatTrigger, launcher] = page
    .getByRole('button', { name: 'Ask AI' })
    .all();
  for (const button of [chatTrigger!, launcher!]) {
    await expect
      .element(button)
      .toHaveAttribute('aria-keyshortcuts', 'Meta+J Control+J');
    await expect.element(button).toHaveTextContent(`Ask AI${command}J`);
  }
});

it('remaps search and turns chat’s shortcut off, in hints and key presses', async () => {
  const { chat } = createTestChat({ answer: () => ({ text: 'Answer.' }) });
  await render(
    <Docspot.Root
      search={() => results}
      chat={chat}
      shortcuts={{ search: 'Shift+Mod+F', chat: false }}
    >
      <Surfaces />
    </Docspot.Root>
  );
  const searchTrigger = page.getByRole('button', {
    name: 'Search or ask docs',
  });
  await expect
    .element(searchTrigger)
    .toHaveAttribute('aria-keyshortcuts', 'Shift+Meta+F Shift+Control+F');
  await expect.element(searchTrigger).toHaveTextContent(`⇧${command}F`);
  const [chatTrigger, launcher] = page
    .getByRole('button', { name: 'Ask AI' })
    .all();
  for (const button of [chatTrigger!, launcher!]) {
    await expect.element(button).not.toHaveAttribute('aria-keyshortcuts');
    // No key hint follows the label.
    await expect.element(button).toHaveTextContent(/^Ask AI$/);
  }

  // The defaults no longer open anything.
  await userEvent.keyboard(`{${modifier}>}k{/${modifier}}/`);
  await userEvent.keyboard(`{${modifier}>}j{/${modifier}}`);
  await settle();
  expect(searchDialog().query()).toBeNull();
  expect(panel().query()).toBeNull();

  await userEvent.keyboard(`{Shift>}{${modifier}>}f{/${modifier}}{/Shift}`);
  await expect.element(searchInput()).toHaveFocus();
  // Without chat's shortcut, search doesn't ask with it, and ⌘K types on.
  await userEvent.keyboard(`joins{${modifier}>}j{/${modifier}}`);
  await userEvent.keyboard(`{${modifier}>}k{/${modifier}}`);
  await settle();
  await expect.element(searchInput()).toHaveValue('joins');
  expect(panel().query()).toBeNull();
  // The search shortcut closes search too.
  await userEvent.keyboard(`{Shift>}{${modifier}>}f{/${modifier}}{/Shift}`);
  await expect.element(searchDialog()).not.toBeInTheDocument();
});

it('asks, toggles chat, and closes the panel with a remapped chat shortcut on any layout', async () => {
  const { chat } = createTestChat({
    answer: ({ question }) => ({ text: `About ${question}.` }),
  });
  await render(
    <Docspot.Root
      search={() => results}
      chat={chat}
      shortcuts={{ chat: 'Mod+I' }}
    >
      <Surfaces />
    </Docspot.Root>
  );
  const chatTrigger = page.getByRole('button', { name: 'Ask AI' }).first();
  await expect
    .element(chatTrigger)
    .toHaveAttribute('aria-keyshortcuts', 'Meta+I Control+I');
  await expect.element(chatTrigger).toHaveTextContent(`Ask AI${command}I`);

  await userEvent.keyboard('/');
  await expect.element(searchInput()).toHaveFocus();
  await userEvent.keyboard(`joins{${modifier}>}i{/${modifier}}`);
  await expect.element(searchDialog()).not.toBeInTheDocument();
  await expect.element(panel().getByText('About joins.')).toBeVisible();
  await expect.element(composer()).toHaveFocus();

  // In the panel, the old key does nothing and the new one closes it.
  await userEvent.keyboard(`{${modifier}>}j{/${modifier}}`);
  await settle();
  await expect.element(composer()).toHaveFocus();
  await userEvent.keyboard(`{${modifier}>}i{/${modifier}}`);
  await expect.element(panel()).not.toBeInTheDocument();

  // Ctrl+I on a Russian layout types “ш”; Dvorak's I, in QWERTY's C
  // position, types “i”.
  pressWithControl('ш', 'KeyI');
  await expect.element(composer()).toHaveFocus();
  pressWithControl('i', 'KeyC');
  await expect.element(panel()).not.toBeInTheDocument();
});

it('fires a character shortcut only outside fields', async () => {
  const { chat } = createTestChat({ answer: () => ({ text: 'Answer.' }) });
  await render(<Docspot chat={chat} shortcuts={{ chat: '?' }} />);
  const trigger = page.getByRole('button', { name: 'Ask AI' });
  await expect.element(trigger).toHaveAttribute('aria-keyshortcuts', '?');
  await expect.element(trigger).toHaveTextContent('Ask AI?');
  // ⌘ or Ctrl turns it into another shortcut.
  await userEvent.keyboard(`{${modifier}>}?{/${modifier}}`);
  await settle();
  expect(panel().query()).toBeNull();

  await userEvent.keyboard('?');
  await expect.element(composer()).toHaveFocus();
  await userEvent.keyboard('why?');
  await expect.element(composer()).toHaveValue('why?');
  await expect.element(panel()).toBeVisible();
});

it('warms search on a modifier only when one of its shortcuts holds it', async () => {
  const preload = vi.fn();
  const search = createSearch(() => results, { preload });
  // No trigger: hovering one warms search too, wherever an earlier test
  // left the pointer.
  await render(
    <Docspot.Root search={search} shortcuts={{ search: '/' }}>
      <Docspot.SearchDialog />
    </Docspot.Root>
  );
  await vi.waitFor(() => expect(preload).toHaveBeenCalled());
  preload.mockClear();
  await userEvent.keyboard(`{${modifier}}`);
  expect(preload).not.toHaveBeenCalled();
  await userEvent.keyboard('/');
  await expect.element(searchInput()).toHaveFocus();
});
