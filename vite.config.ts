/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset URLs so the build also works from Capacitor's file-based WebView.
  base: './',
  build: {
    target: 'es2022',
    // Keep the PNGs as real files instead of re-inlining them as base64.
    assetsInlineLimit: 0,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
