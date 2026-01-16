// /middleware/index.ts - 使用修正后的 swaggerUISimple
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import serve from 'koa-static';
import logger from './logger';
import errorHandler from './errorHandler';
import cors from './cors';
import config from '../config';

// 2.2版本新增 Prometheus HTTP监控
// import httpMonitor from '../monitor/collectors/http-collector';
import { createHTTPMonitoringMiddleware } from '../monitor/collectors/http-collector-enhanced';

// 1.4版本新增性能监控中间件
import { performanceMonitor } from './performance';

// 1.3版本中间件
import compression from './compression';
import security from './security';
import rateLimit from './rateLimit';
// 使用简化版的 Swagger UI
// import { swaggerUISimple as swaggerUI } from './swagger';
import { swaggerUIOptimized as swaggerUI } from './swagger';

// 导入 CSP 路径配置
import { getCSPForPath } from '../config/csp-paths';

export default (app: Koa): void => {
  // ========== 1. 性能监控（最外层，测量完整请求时间） ==========
  if (config.env !== 'test') {
    app.use(performanceMonitor());
  }

  // ========== 1.5 Prometheus HTTP监控 ==========
  // if (config.env !== 'test') {
  //   app.use(httpMonitor());
  // }

  // ========== 1.5 Prometheus HTTP监控(2.2 版本新增) ==========
  if (config.env !== 'test') {
    app.use(
      createHTTPMonitoringMiddleware({
        logRequests: config.env === 'development',
        excludedRoutes: [
          '/metrics',
          '/api/health',
          '/api/performance',
          '/api-docs',
          '/api-docs/',
          '/favicon.ico',
        ],
      }),
    );
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
      jsonLimit: config.env === 'production' ? '1mb' : '10mb',
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
  // if (config.enableSwagger && config.env !== 'production') {
  //   app.use(async (ctx, next) => {
  //     if (ctx.path === '/api-docs' || ctx.path.startsWith('/api-docs/')) {
  //       // 设置允许 Swagger UI 加载外部资源的 CSP
  //       ctx.set(
  //         'Content-Security-Policy',
  //         "default-src 'self'; " +
  //           "style-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net https://fonts.googleapis.com https://cdnjs.cloudflare.com; " +
  //           "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
  //           "img-src 'self' data: https:; " +
  //           "font-src 'self' https://fonts.gstatic.com https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
  //           "connect-src 'self';",
  //       );
  //     }
  //     await next();
  //   });
  // }

  // ========== 9. 为特定页面设置专门的 CSP 头 ==========
  // 统一处理所有需要特殊 CSP 的页面
  app.use(async (ctx, next) => {
    const cspPolicy = getCSPForPath(config.env, ctx.path);
    if (cspPolicy) {
      ctx.set('Content-Security-Policy', cspPolicy);

      // 开发环境记录日志
      if (config.env !== 'production') {
        console.log(`🔄 为 ${ctx.path} 设置特殊 CSP 策略`);
      }
    }
    await next();
  });

  // ========== 10. Swagger UI（1.3版本） ==========
  if (config.enableSwagger && config.env !== 'production') {
    app.use(swaggerUI());
  }

  // ========== 11. 静态文件服务 ==========
  app.use(
    serve('public', {
      maxage: config.env === 'production' ? 86400000 : 0,
      hidden: false,
      index: 'index.html',
      defer: false,
    }),
  );

  console.log(`✅ 中间件加载完成（共${app.middleware.length}个）`);

  if (config.enableSwagger && config.env !== 'production') {
    console.log(`📖 Swagger UI 地址: http://localhost:${config.port}/api-docs`);
  }
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
