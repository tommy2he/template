/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.ts'],
  roots: ['<rootDir>/test'],
  collectCoverageFrom: ['src/**/*.ts', '!src/index.ts', '!src/**/index.ts'],
  coverageDirectory: 'coverage',

  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@middleware/(.*)$': '<rootDir>/src/middleware/$1',
    '^@routes/(.*)$': '<rootDir>/src/routes/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    // 添加 chalk 的 mock
    '^chalk$': '<rootDir>/test/__mocks__/chalk.js',
  },

  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.test.json',
      },
    ],
  },

  // 忽略 chalk 的转换
  transformIgnorePatterns: ['/node_modules/(?!(chalk)/)'],

  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

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
