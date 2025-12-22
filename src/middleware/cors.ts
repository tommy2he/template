import { Context, Next } from 'koa';
import config from '../config';

export default function cors() {
  return async (ctx: Context, next: Next) => {
    // 设置 CORS 头
    ctx.set('Access-Control-Allow-Origin', config.corsOrigin);
    ctx.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    ctx.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, Accept',
    );
    ctx.set('Access-Control-Allow-Credentials', 'true');
    ctx.set('Access-Control-Max-Age', '86400'); // 24小时

    // 处理预检请求
    if (ctx.method === 'OPTIONS') {
      ctx.status = 204;
      return;
    }

    await next();
  };
}
