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
  test: {
    // Only pure logic is tested, no DOM needed
    environment: 'node',
  },
});
