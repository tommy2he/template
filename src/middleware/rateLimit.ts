import { Context, Next } from 'koa';
import RateLimit from 'koa-ratelimit';
import config from '../config';

export default function rateLimit() {
  return RateLimit({
    driver: 'memory',
    db: new Map(),
    duration: 900000, // 15 minutes
    errorMessage: '请求过于频繁，请稍后再试',
    id: (ctx: Context) => ctx.ip,
    headers: {
      remaining: 'Rate-Limit-Remaining',
      reset: 'Rate-Limit-Reset',
      total: 'Rate-Limit-Total',
    },
    max: 100, // 每个IP在15分钟内最多100次请求
    disableHeader: false,
    whitelist: (ctx: Context) => {
      // 排除健康检查等不需要限流的端点
      const excludedPaths = ['/api/health', '/', '/favicon.ico'];
      return excludedPaths.includes(ctx.path);
    },
    blacklist: (ctx: Context) => {
      // 可以根据需要添加黑名单逻辑
      return false;
    },
  });
}

// 增强版速率限制，支持不同策略
export function createRateLimiter(options: {
  max: number;
  duration: number;
  prefix?: string;
  message?: string;
}) {
  return RateLimit({
    driver: 'memory',
    db: new Map(),
    duration: options.duration,
    errorMessage: options.message || '请求过于频繁，请稍后再试',
    id: (ctx: Context) => {
      const prefix = options.prefix || 'global';
      return `${prefix}:${ctx.ip}:${ctx.path}`;
    },
    max: options.max,
    disableHeader: false,
  });
}
