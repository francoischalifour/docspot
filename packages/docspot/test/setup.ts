import { afterEach } from 'vitest';
import { cleanup } from 'vitest-browser-react';

import '../src/styles.css';

afterEach(async () => {
  await cleanup();
  localStorage.clear();
  history.replaceState(null, '', '/');
  document.documentElement.removeAttribute('style');
});
