import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// `base` must match the GitHub Pages path: https://noblewolf412.github.io/ley-atlas/
const base = '/ley-atlas/';
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(version) }, // shown at the bottom of the menu
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  test: { environment: 'node', include: ['tests/**/*.test.js'] },
  plugins: [
    // Installable app + offline use. The service worker keeps the app and its datasets on the
    // device after the first visit, and picks up new versions by itself on the next visit.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'Ley Atlas',
        short_name: 'Ley Atlas',
        description:
          'Interactive map of ley lines, ancient monuments and star forts, with what lies along each line underground.',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'any',
        background_color: '#12161c',
        theme_color: '#12161c',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,png,json}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // the detailed basemap is 3.6 MB
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'fonts', expiration: { maxEntries: 20 } },
          },
        ],
      },
    }),
  ],
});
