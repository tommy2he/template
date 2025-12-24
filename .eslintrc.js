module.exports = {
  env: {
    node: true,
    es2021: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    'no-console': 'warn',
  },
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: './tsconfig.json',
      },
    },
  },
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'reports/',
    '*.json',
    '*.config.js',
    '*.d.ts',
    'package.json',
    'jest.setup.js',
    '*.report.html',
  ],
  overrides: [
    {
      files: [
        'test/scripts/**/*.js',
        'test/**/*.ts',
        'jest.config.js',
        'jest.*.config.js',
        'jest.setup.js',
      ],
      rules: {
        '@typescript-eslint/no-require-imports': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
        'no-console': 'off',
      },
    },
  ],
};
