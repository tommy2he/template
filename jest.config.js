/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.ts'],
  roots: ['<rootDir>/test'],
  collectCoverageFrom: ['src/**/*.ts', '!src/index.ts', '!src/**/index.ts'],
  coverageDirectory: 'coverage',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {}],
  },
  reporters: [
    'default',
    [
      'jest-html-reporter',
      {
        pageTitle: 'Koa Template App - Test Report',
        outputPath: './test-report.html',
        includeFailureMsg: true,
        includeConsoleLog: true,
        logo: './public/logo.svg',
        theme: 'lightTheme',
        styleOverridePath: './test-report-style.css',
        dateFormat: 'yyyy-mm-dd HH:MM:ss',
        sort: 'titleAsc',
        executionTimeWarningThreshold: 5,
      },
    ],
  ],
};
