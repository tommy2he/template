/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/index.ts', '!src/**/index.ts'],
  coverageDirectory: 'coverage',
  transform: {
    // 使用新的配置方式，消除警告
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        // 可以在这里添加 ts-jest 的特定配置
        // 例如：tsconfig: 'tsconfig.test.json'
      },
    ],
  },
};
