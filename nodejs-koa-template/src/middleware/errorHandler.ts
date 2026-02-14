import { Context, Next } from 'koa';

export default function errorHandler() {
  return async (ctx: Context, next: Next) => {
    try {
      await next();
    } catch (err: unknown) {
      let status = 500;
      let message = 'Internal Server Error';

      if (err && typeof err === 'object' && 'status' in err) {
        status = (err as { status: number }).status || status;
      }

      if (err instanceof Error) {
        message = err.message;
      }

      ctx.status = status;
      ctx.body = { message };

      if (err instanceof Error) {
        ctx.app.emit('error', err, ctx);
      }
    }
  };
}
