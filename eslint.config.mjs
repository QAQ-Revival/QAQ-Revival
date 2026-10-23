import globals from 'globals';

const correctnessRules = {
  'no-undef': 'error',
  'no-unreachable': 'error',
  'no-dupe-args': 'error',
  'no-dupe-keys': 'error'
};

export default [
  { ignores: ['app/out/**', 'app/src/**/.*', '**/node_modules/**'] },
  {
    files: ['app/src/main/**/*.{js,cjs}', 'app/src/preload/**/*.{js,cjs}', 'app/src/shared/**/*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
    rules: correctnessRules
  },
  {
    files: ['app/src/renderer/**/*.{js,jsx,mjs}', 'app/src/shared/**/*.mjs'],
    languageOptions: {
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } }
    },
    rules: correctnessRules
  },
  {
    // These functions are serialized and executed inside the site's BrowserWindow.
    files: ['app/src/main/site-parsers.cjs', 'app/src/main/site-verification.cjs', 'app/src/preload/**/*.js'],
    languageOptions: { globals: globals.browser }
  }
];
