import { expect, it } from 'vitest';

import styles from '@/styles.css?raw';

function declarations(block: string) {
  return Object.fromEntries(
    [...block.matchAll(/(--docspot-[\w-]+):\s*([^;]+);/g)].map(match => [
      match[1],
      match[2]!.replace(/\s+/g, ' ').trim(),
    ])
  );
}

function blockAfter(selector: string) {
  const start = styles.indexOf(selector);
  expect(start).toBeGreaterThan(-1);
  const open = styles.indexOf('{', start);
  return styles.slice(open + 1, styles.indexOf('}', open));
}

it('defines the same dark palette for the system preference and the explicit theme', () => {
  const system = declarations(
    blockAfter(":where(:root:not([data-theme='light'], .light))")
  );
  const explicit = declarations(
    blockAfter(":where(:root:is([data-theme='dark'], .dark))")
  );
  expect(Object.keys(system).length).toBeGreaterThan(10);
  expect(explicit).toEqual(system);
});

it('gives every dark token a light default', () => {
  const light = declarations(blockAfter(':where(:root)'));
  const dark = declarations(
    blockAfter(":where(:root:is([data-theme='dark'], .dark))")
  );
  // Optional tokens fall back where they are used, in both themes.
  const optional = ['--docspot-selected'];
  for (const name of Object.keys(dark))
    if (!optional.includes(name)) expect(light).toHaveProperty(name);
});
