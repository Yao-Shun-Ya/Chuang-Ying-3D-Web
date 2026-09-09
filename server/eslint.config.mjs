// ESLint 9 flat config（替代 .eslintrc.json）
// 等价于原 extends: eslint:recommended + @typescript-eslint/recommended + prettier/recommended
import eslint from '@eslint/js';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'data/**', '.pgdata/**'] },
  eslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      globals: { ...globals.node, Express: 'readonly', NodeJS: 'readonly' },
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      prettier,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...prettierConfig.rules, // 关闭与 prettier 冲突的格式规则
      'prettier/prettier': 'error',
      // 保持可见但不阻断构建：单测 mock / passport req.user / 适配器动态报文存在少量 any 场景
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      'no-console': 'warn',
    },
  },
  {
    // 单测文件不走类型感知规则（tsconfig.json 为构建配置，排除 *.spec.ts）
    files: ['**/*.spec.ts'],
    languageOptions: {
      parserOptions: { project: null },
      globals: { ...globals.node, ...globals.jest },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },
];