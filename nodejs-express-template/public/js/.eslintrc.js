// module.exports = {
//   env: {
//     node: true,
//     browser: true, // 添加浏览器环境
//     es2021: true,
//     jest: true,
//   },
//   extends: ['airbnb-base', 'plugin:prettier/recommended'],
//   overrides: [
//     // 针对前端JavaScript文件的不同配置
//     {
//       files: ['public/**/*.js'],
//       env: {
//         browser: true, // 明确指定浏览器环境
//         node: false, // 禁用Node环境
//       },
//       rules: {
//         'no-console': 'off', // 允许console
//         'no-undef': 'off', // 不检查未定义变量
//         'no-unused-vars': 'warn', // 只警告未使用的变量
//       },
//     },
//     // 针对测试文件的不同配置
//     {
//       files: ['test/**/*.js'],
//       env: {
//         jest: true,
//       },
//     },
//   ],
//   parserOptions: {
//     ecmaVersion: 'latest',
//     sourceType: 'module',
//   },
//   rules: {
//     'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'off',
//     'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
//     'import/extensions': ['error', 'ignorePackages'],
//   },
// };

module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    'no-console': 'off',
    'no-undef': 'off',
    'no-unused-vars': 'warn',
  },
};
