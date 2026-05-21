import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const allowedHosts = [
  '.trycloudflare.com',
  'localhost',
  '127.0.0.1',
];

if (process.env.PUBLIC_BASE_URL) {
  try {
    allowedHosts.push(new URL(process.env.PUBLIC_BASE_URL).hostname);
  } catch {
    // Ignore invalid local env values; the explicit tunnel suffix still covers quick tunnels.
  }
}

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    allowedHosts,
  },
  preview: {
    allowedHosts,
  },
});
