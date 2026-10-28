/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solid()],
  // Relative paths, so the build works both on the custom domain and under /<repo>/
  base: './',
  build: {
    target: 'es2022',
  },
  server: {
    // Dev server is also reachable through the Paseo service proxy
    allowedHosts: ['.apps.pc-paseo.pantas.pw'],
    // Behind that proxy, the HMR socket must go through https too. Also stops Vite
    // from falling back to a direct 127.0.0.1 connection, which remote browsers can't reach.
    hmr: process.env.BEHIND_PROXY ? { clientPort: 443 } : undefined,
  },
  test: {
    // Only pure logic is tested, no DOM needed
    environment: 'node',
  },
});
