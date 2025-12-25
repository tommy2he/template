import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import serve from 'koa-static';
import logger from './logger';
import errorHandler from './errorHandler';
import cors from './cors';
import config from '../config';

// 1.4版本新增性能监控中间件
import { performanceMonitor } from './performance';

// 1.3版本中间件
import compression from './compression';
import security from './security';
import rateLimit from './rateLimit';
import { swaggerUI } from './swagger';

export default (app: Koa): void => {
  // ========== 1. 性能监控（最外层，测量完整请求时间） ==========
  if (config.env !== 'test') {
    app.use(performanceMonitor());
  }

  // ========== 2. 错误处理 ==========
  app.use(errorHandler());

  // ========== 3. CORS ==========
  app.use(cors());

  // ========== 4. 安全头（1.3版本） ==========
  if (config.security.enabled && config.env !== 'test') {
    app.use(security());
  }

  // ========== 5. 日志 ==========
  app.use(logger());

  // ========== 6. 请求体解析 ==========
  app.use(
    bodyParser({
      enableTypes: ['json', 'form', 'text'],
      jsonLimit: config.env === 'production' ? '1mb' : '10mb', // 生产环境限制更严格
      formLimit: config.env === 'production' ? '1mb' : '10mb',
      textLimit: config.env === 'production' ? '1mb' : '10mb',
    }),
  );

  // ========== 7. 压缩中间件（1.3版本） ==========
  if (config.compression.enabled) {
    app.use(compression());
  }

  // ========== 8. 速率限制（1.3版本） ==========
  if (config.rateLimit.enabled && config.env === 'production') {
    app.use(rateLimit());
  }

  // ========== 9. 为 Swagger UI 设置专门的 CSP 头 ==========
  if (config.enableSwagger && config.env !== 'production') {
    app.use(async (ctx, next) => {
      if (ctx.path === '/api-docs' || ctx.path.startsWith('/api-docs/')) {
        // 设置允许 Swagger UI 加载外部资源的 CSP
        // 添加 cdnjs.cloudflare.com
        ctx.set(
          'Content-Security-Policy',
          "default-src 'self'; " +
            "style-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net https://fonts.googleapis.com https://cdnjs.cloudflare.com; " +
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
            "img-src 'self' data: https:; " +
            "font-src 'self' https://fonts.gstatic.com https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
            "connect-src 'self';",
        );
      }
      await next();
    });
  }

  // ========== 10. Swagger UI（1.3版本） ==========
  // 注意：必须在 CSP 中间件之后
  if (config.enableSwagger && config.env !== 'production') {
    app.use(swaggerUI());
  }

  // ========== 11. 静态文件服务 ==========
  app.use(
    serve('public', {
      maxage: config.env === 'production' ? 86400000 : 0, // 生产环境缓存1天
      hidden: false,
      index: 'index.html',
      defer: false,
      //defer: true, // 让Koa先处理其他中间件
    }),
  );

  console.log(`✅ 中间件加载完成（共${app.middleware.length}个）`);
  console.log(`📖 Swagger UI 地址: http://localhost:${config.port}/api-docs`);
};

// 导出所有中间件，方便单独使用
export * from './logger';
export * from './errorHandler';
export * from './cors';
export * from './compression';
export * from './security';
export * from './rateLimit';
export * from './swagger';
export * from './performance';
