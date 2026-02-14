// src/middleware/rateLimit.ts
import { Context, Next } from 'koa';
import config from '../config';

// 定义类型接口
interface RateLimitMiddleware {
  (ctx: Context, next: Next): Promise<void>;
}

// 内置的简单速率限制实现
export function createBuiltInRateLimit(options: {
  max: number;
  windowMs: number;
  message?: string;
  skip?: (ctx: Context) => boolean;
}): RateLimitMiddleware {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return async (ctx: Context, next: Next) => {
    // 检查是否跳过速率限制
    if (options.skip && options.skip(ctx)) {
      await next();
      return;
    }

    const key = ctx.ip || ctx.request.ip;
    const now = Date.now();

    // 清理过期的记录
    cleanupExpired(requests, now);

    // 获取或初始化记录
    let record = requests.get(key);
    if (!record || now > record.resetTime) {
      record = {
        count: 0,
        resetTime: now + options.windowMs,
      };
      requests.set(key, record);
    }

    // 检查是否超过限制
    if (record.count >= options.max) {
      ctx.status = 429;
      ctx.body = {
        error: 'Too Many Requests',
        message: options.message || '请求过于频繁，请稍后再试',
        retryAfter: Math.ceil((record.resetTime - now) / 1000),
      };
      return;
    }

    // 增加计数
    record.count++;

    // 设置响应头
    setRateLimitHeaders(ctx, {
      limit: options.max,
      remaining: options.max - record.count,
      reset: Math.ceil(record.resetTime / 1000),
    });

    await next();
  };
}

// 主速率限制中间件（使用默认配置）
export default function rateLimit(): RateLimitMiddleware {
  return createBuiltInRateLimit({
    max: config.rateLimit?.maxRequests || 100,
    windowMs: config.rateLimit?.windowMs || 900000,
    message: '请求过于频繁，请稍后再试',
    skip: (ctx: Context) => {
      // 排除不需要限流的端点
      const excludedPaths = [
        '/api/health',
        '/',
        '/favicon.ico',
        '/api-docs',
        '/swagger.json',
      ];
      return excludedPaths.includes(ctx.path);
    },
  });
}

// 清理过期的记录
function cleanupExpired(
  requests: Map<string, { count: number; resetTime: number }>,
  now: number,
): void {
  for (const [ip, data] of requests.entries()) {
    if (now > data.resetTime) {
      requests.delete(ip);
    }
  }
}

// 设置速率限制头
function setRateLimitHeaders(
  ctx: Context,
  data: { limit: number; remaining: number; reset: number },
): void {
  ctx.set('X-RateLimit-Limit', data.limit.toString());
  ctx.set('X-RateLimit-Remaining', data.remaining.toString());
  ctx.set('X-RateLimit-Reset', data.reset.toString());
}

// 增强的速率限制中间件（支持多种策略）
export class RateLimiter {
  private requests: Map<string, { count: number; resetTime: number }>;

  constructor(
    private max: number,
    private windowMs: number,
    private message: string = '请求过于频繁',
  ) {
    this.requests = new Map();
  }

  middleware(): RateLimitMiddleware {
    return async (ctx: Context, next: Next) => {
      const key = this.getKey(ctx);
      const now = Date.now();

      this.cleanup(now);

      let record = this.requests.get(key);
      if (!record || now > record.resetTime) {
        record = { count: 0, resetTime: now + this.windowMs };
        this.requests.set(key, record);
      }

      if (record.count >= this.max) {
        ctx.status = 429;
        ctx.body = {
          error: 'Too Many Requests',
          message: this.message,
          retryAfter: Math.ceil((record.resetTime - now) / 1000),
        };
        return;
      }

      record.count++;
      this.setHeaders(ctx, record);
      await next();
    };
  }

  private getKey(ctx: Context): string {
    // 可以根据需要定制key的生成策略
    return ctx.ip || ctx.request.ip;
  }

  private cleanup(now: number): void {
    for (const [key, data] of this.requests.entries()) {
      if (now > data.resetTime) {
        this.requests.delete(key);
      }
    }
  }

  private setHeaders(
    ctx: Context,
    record: { count: number; resetTime: number },
  ): void {
    ctx.set('X-RateLimit-Limit', this.max.toString());
    ctx.set('X-RateLimit-Remaining', (this.max - record.count).toString());
    ctx.set('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000).toString());
  }
}

// 为了方便，也导出 builtInRateLimit 作为别名
export const builtInRateLimit = createBuiltInRateLimit;
