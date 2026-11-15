import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/', 'node_modules/', 'public/'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser, __APP_VERSION__: 'readonly' }, // set in vite.config.js
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-cond-assign': 'off',
      'no-sparse-arrays': 'off',
    },
  },
  // Layering: a folder may only import from the folders below it (see ARCHITECTURE.md).
  ...[
    ['core', ['data', 'state', 'domain', 'render', 'map', 'layers', 'features', 'ui', 'panels']],
    ['data', ['state', 'domain', 'render', 'map', 'layers', 'features', 'ui', 'panels']],
    ['state', ['domain', 'render', 'map', 'layers', 'features', 'ui', 'panels']],
    ['domain', ['render', 'map', 'layers', 'features', 'ui', 'panels']],
    ['render', ['map', 'layers', 'features', 'ui', 'panels']],
    ['map', ['features', 'ui', 'panels']],
    ['layers', ['features', 'ui', 'panels']],
  ].map(([folder, above]) => ({
    files: [`src/${folder}/**/*.js`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: above.map(a => `**/${a}/*`),
              message: `src/${folder}/ must not import from a layer above it. Use an event (core/events.js) or a hook (map/hooks.js).`,
            },
          ],
        },
      ],
    },
  })),
  {
    files: ['tests/**/*.js', '*.config.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: globals.node },
  },
];
