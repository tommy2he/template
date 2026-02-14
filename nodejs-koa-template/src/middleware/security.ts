import { Context, Next } from 'koa';
import helmet from 'koa-helmet';
import config from '../config';

export default function security() {
  return helmet({
    // 基础安全头
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    // HSTS设置（生产环境启用）
    hsts:
      config.env === 'production'
        ? {
            maxAge: 31536000, // 1年
            includeSubDomains: true,
            preload: true,
          }
        : false,

    // 防止点击劫持
    frameguard: { action: 'deny' },

    // 防止MIME类型嗅探
    noSniff: true,

    // XSS保护
    xssFilter: true,

    // 隐藏X-Powered-By头
    hidePoweredBy: true,

    // IE无兼容模式
    ieNoOpen: true,

    // 防止DNS预取
    dnsPrefetchControl: { allow: false },
  });
}

// 自定义安全头 - 移除 CSP 设置以避免冲突
export function customSecurityHeaders() {
  return async (ctx: Context, next: Next) => {
    await next();

    // 添加额外的安全头
    ctx.set('X-Content-Type-Options', 'nosniff');
    ctx.set('X-Frame-Options', 'DENY');
    ctx.set('X-XSS-Protection', '1; mode=block');
    ctx.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    ctx.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    // 注意：已移除开发环境的 CSP 设置
    // 所有 CSP 逻辑现在由 security() 和 index.ts 中的专门中间件处理
    // 这样可以避免 CSP 头被重复设置和覆盖
    // 在开发环境，允许更宽松的CSP用于调试
    // if (config.env === 'development') {
    //   ctx.set(
    //     'Content-Security-Policy',
    //     "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
    //   );
    // }
  };
}
