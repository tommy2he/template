import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import serve from 'koa-static';
import logger from './logger';
import errorHandler from './errorHandler';
import cors from './cors';
import config from '../config';

// 1.3版本新增中间件
import compression from './compression';
import security from './security';
import rateLimit from './rateLimit';
import { swaggerUI } from './swagger'; // 只导入 swaggerUI

export default (app: Koa): void => {
  // 错误处理（第一层）
  app.use(errorHandler());

  // CORS
  app.use(cors());

  // 安全头（1.3版本新增）
  if (config.env !== 'test') {
    app.use(security());
  }

  // 日志
  app.use(logger());

  // 请求体解析
  app.use(
    bodyParser({
      enableTypes: ['json', 'form', 'text'],
      jsonLimit: '10mb',
      formLimit: '10mb',
    }),
  );

  // 压缩中间件（1.3版本新增）
  if (config.env === 'production') {
    app.use(compression());
  }

  // 速率限制（1.3版本新增）
  if (config.env === 'production') {
    app.use(rateLimit());
  }

  // Swagger UI 中间件（1.3版本新增）
  if (config.enableSwagger) {
    app.use(swaggerUI());
  }

  // 静态文件服务
  app.use(
    serve('public', {
      maxage: config.env === 'production' ? 86400000 : 0, // 生产环境缓存1天
    }),
  );
};

// 导出所有中间件，方便单独使用
export * from './logger';
export * from './errorHandler';
export * from './cors';
export * from './compression';
export * from './security';
export * from './rateLimit';
export * from './swagger';
