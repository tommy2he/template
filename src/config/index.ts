import dotenv from 'dotenv';
import path from 'path';

// 根据环境加载不同的 .env 文件
const envFile =
  process.env.NODE_ENV === 'test'
    ? '.env.test'
    : process.env.NODE_ENV === 'production'
      ? '.env.production'
      : '.env';

dotenv.config({ path: path.resolve(process.cwd(), envFile) });

interface Config {
  // 应用配置
  env: string;
  port: number;
  appName: string;
  appUrl: string;

  // 日志配置
  logLevel: string;
  logFormat: string;

  // API 配置
  apiPrefix: string;
  apiVersion: string;
  apiTimeout: number;

  // CORS 配置
  corsOrigin: string;
  corsCredentials: boolean;

  // 数据库配置
  mongodb: {
    uri: string;
    options: {
      useNewUrlParser: boolean;
      useUnifiedTopology: boolean;
    };
  };

  // 安全配置
  jwtSecret: string;
  jwtExpiresIn: string;

  // 开发配置
  enableSwagger: boolean;
  debug: boolean;

  // 其他配置
  uploadMaxSize: number;
  uploadAllowedTypes: string[];
}

const config: Config = {
  // 应用配置
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000'),
  appName: process.env.APP_NAME || 'Koa Template App',
  appUrl: process.env.APP_URL || 'http://localhost:3000',

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

  // 数据库配置
  mongodb: {
    uri:
      process.env.MONGODB_URI || 'mongodb://localhost:27017/koa_template_dev',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
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
};

// 环境验证
const requiredEnvVars = ['NODE_ENV', 'PORT'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.warn(`⚠️  Warning: ${envVar} is not set in environment variables`);
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
    console.warn(
      '⚠️  Warning: Using local MongoDB in production is not recommended',
    );
  }
}

// 导出辅助函数
export const isDevelopment = config.env === 'development';
export const isProduction = config.env === 'production';
export const isTest = config.env === 'test';

export default config;
