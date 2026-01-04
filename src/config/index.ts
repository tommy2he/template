import dotenv from 'dotenv';
import path from 'path';
import { configLogger } from './logger';
import { IConfig } from './config.interface'; // 导入接口

// 根据环境加载不同的 .env 文件
const envFile =
  process.env.NODE_ENV === 'test'
    ? '.env.test'
    : process.env.NODE_ENV === 'production'
      ? '.env.production'
      : '.env';

dotenv.config({ path: path.resolve(process.cwd(), envFile) });
console.log(`📁 加载环境变量文件: ${envFile}`);

const config: IConfig = {
  // ... 原有的配置对象保持不变
  // 应用配置
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000'),
  appName: process.env.APP_NAME || 'Koa Template App',
  appUrl: process.env.APP_URL || 'http://localhost:3000',

  // WebSocket配置
  wsPort: parseInt(process.env.WS_PORT || '7547'),
  wsUrl:
    process.env.WS_URL ||
    `ws://localhost:${parseInt(process.env.WS_PORT || '7547')}`,

  // 日志配置
  logLevel: process.env.LOG_LEVEL || 'info',
  logFormat: process.env.LOG_FORMAT || 'combined',

  // API 配置
  apiPrefix: process.env.API_PREFIX || '/api',
  apiVersion: process.env.API_VERSION || 'v1',
  apiTimeout: parseInt(process.env.API_TIMEOUT || '30000'),

  // CORS 配置
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  corsCredentials: process.env.CORS_CREDENTIALS === 'true',

  // 数据库配置（已更新 - 与 .env 文件匹配）
  mongodb: {
    uri:
      process.env.MONGODB_URI ||
      'mongodb://koa_user:koa_password@localhost:27017/koa_template_dev',
    adminUri:
      process.env.MONGODB_ADMIN_URI ||
      'mongodb://admin:secret@localhost:27017/admin',
    options: {
      maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE || '10'),
      minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE || '2'),
      socketTimeoutMS: parseInt(
        process.env.MONGODB_SOCKET_TIMEOUT_MS || '45000',
      ),
      connectTimeoutMS: parseInt(
        process.env.MONGODB_CONNECT_TIMEOUT_MS || '30000',
      ),
      retryWrites: process.env.MONGODB_RETRY_WRITES === 'true',
      retryReads: process.env.MONGODB_RETRY_READS === 'true',
      serverSelectionTimeoutMS: 30000,
    },
  },

  // 安全配置
  jwtSecret:
    process.env.JWT_SECRET || 'default_dev_secret_change_in_production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // 开发配置
  enableSwagger: process.env.ENABLE_SWAGGER === 'true',
  debug: process.env.DEBUG === 'true',

  // 其他配置
  uploadMaxSize: parseInt(process.env.UPLOAD_MAX_SIZE || '10485760'),
  uploadAllowedTypes: (
    process.env.UPLOAD_ALLOWED_TYPES || 'image/jpeg,image/png'
  ).split(','),

  // 1.3版本新增配置
  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED === 'true',
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  },
  compression: {
    enabled: process.env.COMPRESSION_ENABLED === 'true',
    threshold: parseInt(process.env.COMPRESSION_THRESHOLD || '1024'),
  },
  security: {
    enabled: process.env.SECURITY_ENABLED === 'true',
    cspEnabled: process.env.CSP_ENABLED === 'true',
    hstsEnabled: process.env.HSTS_ENABLED === 'true',
  },
  swagger: {
    enabled: process.env.SWAGGER_ENABLED === 'true',
    title: process.env.SWAGGER_TITLE || 'Koa Template App API',
    description: process.env.SWAGGER_DESCRIPTION || 'Koa模板应用的API文档',
    version: process.env.SWAGGER_VERSION || '1.0.0',
  },

  // 1.4版本新增性能监控配置
  performance: {
    enabled:
      process.env.PERFORMANCE_MONITORING === 'true' ||
      process.env.NODE_ENV === 'development',
    sampleRate: parseFloat(process.env.PERFORMANCE_SAMPLE_RATE || '1.0'),
    retentionDays: parseInt(process.env.PERFORMANCE_RETENTION_DAYS || '7'),
    endpoints: (
      process.env.PERFORMANCE_ENDPOINTS || '/,/api,/api/health,/api/performance'
    ).split(','),
  },
};

// 环境验证
const requiredEnvVars = ['NODE_ENV', 'PORT'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    configLogger.warn(`${envVar} is not set in environment variables`, {
      environment: config.env,
      variable: envVar,
    });
  }
}

// 生产环境安全检查
if (config.env === 'production') {
  if (config.jwtSecret === 'default_dev_secret_change_in_production') {
    throw new Error('JWT_SECRET must be set in production environment');
  }

  if (
    config.mongodb.uri.includes('localhost') ||
    config.mongodb.uri.includes('127.0.0.1')
  ) {
    configLogger.warn('Using local MongoDB in production is not recommended', {
      environment: config.env,
      mongodbUri: config.mongodb.uri,
      suggestion: 'Use a managed MongoDB service or remote database',
    });
  }

  // 添加新的环境验证
  if (
    !process.env.JWT_SECRET ||
    process.env.JWT_SECRET === 'default_dev_secret_change_in_production'
  ) {
    throw new Error('JWT_SECRET must be set in production environment');
  }
}

// 导出辅助函数
export const isDevelopment = config.env === 'development';
export const isProduction = config.env === 'production';
export const isTest = config.env === 'test';

// 可选：在测试环境禁用配置日志
if (isTest) {
  configLogger.disable();
}

export default config;
