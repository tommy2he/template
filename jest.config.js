// jest.config.js
module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'src/**/*.js',
    'routes/**/*.js',
    '!src/**/*.test.js',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  testMatch: ['**/test/**/*.test.js', '**/test/**/*.spec.js'],
  setupFilesAfterEnv: ['./test/setup.js'],
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,

  // FIX detectOpenHandles warning
  detectOpenHandles: true, // 检测未关闭的资源句柄
  testTimeout: 30000, // 增加测试超时时间
};
