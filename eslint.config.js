import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist',
      'public/sandbox',
      'public/tsw-types',
      'src/generated',
      'content',
      'labs/**/node_modules',
      'labs/**/dist',
      'coverage',
      'playwright-report',
      'test-results',
      '.debug',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // 平台本身的代码禁止 eval / new Function（学生代码只在沙箱中执行）
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
    },
  },
  {
    // 沙箱运行时需要实现宽松的测试 API（与 Vitest 的 any 签名一致）
    files: ['sandbox/**/*.ts', 'sandbox/types/**/*.d.ts'],
    rules: { '@typescript-eslint/no-explicit-any': 'off', '@typescript-eslint/no-unsafe-function-type': 'off' },
  },
);
