const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  testMatch: ['**/test/integration/**/*.integration.test.ts'],
  coverageDirectory: 'reports/integration/coverage',
  reporters: [
    'default',
    [
      'jest-html-reporter',
      {
        pageTitle: 'Koa Template App - Integration Test Report',
        outputPath: './reports/integration/test-report.html', // 固定路径
        includeFailureMsg: true,
        includeConsoleLog: true,
        logo: './public/logo.svg',
        theme: 'lightTheme',
        styleOverridePath: './test/css/test-report-style.css',
        dateFormat: 'yyyy-mm-dd HH:MM:ss',
        sort: 'titleAsc',
        executionTimeWarningThreshold: 5,
      },
    ],
  ],
};
