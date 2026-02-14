module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true,
  },
  extends: ['eslint:recommended', 'plugin:prettier/recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    'no-console': 'off',
    'no-unused-vars': 'warn',
    'prettier/prettier': 'error',
    'consistent-return': 'warn',
    'arrow-body-style': ['warn', 'as-needed'],
  },
  ignorePatterns: ['node_modules/', 'dist/', 'coverage/'],
};
