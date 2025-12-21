import { Context, Next } from 'koa';

export default function logger() {
  return async (ctx: Context, next: Next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    console.log(`${ctx.method} ${ctx.url} - ${ms}ms`);
  };
}
