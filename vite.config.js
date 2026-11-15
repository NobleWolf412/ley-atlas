import { defineConfig } from 'vite';

// `base` must match the GitHub Pages path: https://noblewolf412.github.io/ley-atlas/
export default defineConfig({
  base: '/ley-atlas/',
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  test: { environment: 'node', include: ['tests/**/*.test.js'] },
});
