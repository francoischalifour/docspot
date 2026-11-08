import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { chatServer } from './chat-server';

export default defineConfig({
  plugins: [react(), chatServer()],
  server: { port: 5174 },
});
