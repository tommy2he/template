/**
 * 应用常量配置
 */

export const TEST_CONSTANTS = {
  // 路径常量
  PATHS: {
    REPORTS: {
      UNIT: 'reports/unit',
      INTEGRATION: 'reports/integration',
      PERFORMANCE: 'reports/performance',
      E2E: 'reports/e2e',
    },
    TEST: {
      UNIT: 'test/unit',
      INTEGRATION: 'test/integration',
      E2E: 'test/e2e',
      SCRIPTS: 'test/scripts',
      CSS: 'test/css',
    },
  },

  // 测试配置
  TEST_CONFIG: {
    TIMEOUT: {
      UNIT: 5000,
      INTEGRATION: 30000,
      E2E: 60000,
    },
    PORT: {
      TEST: 3001,
      DEVELOPMENT: 3300,
      PRODUCTION: process.env.PORT || 3300,
    },
  },

  // 性能测试配置
  PERFORMANCE: {
    CONCURRENT_USERS: 100,
    DURATION: '30s',
    THRESHOLDS: {
      RESPONSE_TIME: 200,
      ERROR_RATE: 0.01,
    },
  },
};

/**
 * 环境变量常量
 */
export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
} as const;
