/** @type {import('ts-jest').JestConfigWithTsJest} */
const baseConfig = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  collectCoverageFrom: ['src/**/*.ts', '!src/index.ts', '!src/**/index.ts'],

  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@middleware/(.*)$': '<rootDir>/src/middleware/$1',
    '^@routes/(.*)$': '<rootDir>/src/routes/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
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

  transformIgnorePatterns: ['/node_modules/(?!(chalk)/)'],

  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // 这里没有 reporters 和 coverageDirectory，由子配置定义
};

module.exports = baseConfig;
