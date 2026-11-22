import { afterEach, expect, it } from 'vitest';
import { commands } from 'vitest/browser';

declare module 'vitest/browser' {
  interface BrowserCommands {
    emulateColorScheme: (colorScheme: 'light' | 'dark' | null) => Promise<void>;
  }
}

// The color tokens the README documents.
const colorTokens = [
  'background',
  'foreground',
  'muted',
  'subtle',
  'border',
  'border-strong',
  'surface',
  'surface-elevated',
  'accent',
  'accent-active',
  'primary',
  'primary-foreground',
  'danger',
  'overlay',
].map(name => `--docspot-${name}`);

const root = document.documentElement;
const palette = () => {
  const style = getComputedStyle(root);
  return Object.fromEntries(
    colorTokens.map(name => [name, style.getPropertyValue(name).trim()])
  );
};

afterEach(async () => {
  await commands.emulateColorScheme(null);
  root.removeAttribute('data-theme');
  root.classList.remove('dark', 'light');
});

it('applies the same dark palette from the system setting, data-theme, or .dark', async () => {
  await commands.emulateColorScheme('light');
  const light = palette();
  for (const value of Object.values(light)) expect(value).not.toBe('');

  await commands.emulateColorScheme('dark');
  const system = palette();
  expect(system).not.toEqual(light);

  await commands.emulateColorScheme('light');
  root.dataset.theme = 'dark';
  expect(palette()).toEqual(system);
  root.removeAttribute('data-theme');
  root.classList.add('dark');
  expect(palette()).toEqual(system);
});

it('keeps the light palette when a site chooses it over a dark system setting', async () => {
  await commands.emulateColorScheme('light');
  const light = palette();
  await commands.emulateColorScheme('dark');
  root.dataset.theme = 'light';
  expect(palette()).toEqual(light);
  root.removeAttribute('data-theme');
  root.classList.add('light');
  expect(palette()).toEqual(light);
});
