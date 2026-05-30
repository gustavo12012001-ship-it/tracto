import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist/**',
    'node_modules/**',
    '.claude/**',
    'tmp_jsx/**',
    'tmp_*.tsx',
    '*.backup.*',
    // E2E roda com @playwright/test (devDep opcional, fora do lockfile da CI).
    'e2e/**',
    'playwright.config.ts',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Convenção: vars/args prefixados com `_` são intencionalmente não usados.
      // caughtErrors:'none' ignora bindings de catch não usados (ex.: catch (e)).
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrors: 'none',
      }],
      // Regras do React Compiler (eslint-plugin-react-hooks v6) são HINTS de
      // otimização/DX, não bugs de correção. Mantidas como WARNING para guiar
      // melhorias sem bloquear a CI nem exigir refactors arriscados imediatos.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-refresh/only-export-components': 'warn',
    },
  },
])
