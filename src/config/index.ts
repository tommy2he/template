// src/config/index.ts
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

interface Config {
  env: string;
  port: number;
  logLevel: string;
  apiPrefix: string;
  // 数据库配置（为1.5版本预留）
  db?: {
    host: string;
    port: number;
    name: string;
  };
}

const config: Config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000'),
  logLevel: process.env.LOG_LEVEL || 'info',
  apiPrefix: process.env.API_PREFIX || '/api',
};

export default config;
