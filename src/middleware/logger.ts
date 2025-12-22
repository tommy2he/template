import { Context, Next } from 'koa';
import chalk from 'chalk';

export default function logger() {
  return async (ctx: Context, next: Next) => {
    const start = Date.now();

    try {
      await next();
    } catch (error) {
      // 记录错误
      const ms = Date.now() - start;
      console.log(
        chalk.red(
          `[${new Date().toISOString()}] ${ctx.method} ${ctx.url} - ${ctx.status || 500} - ${ms}ms`,
        ),
      );
      throw error;
    }

    const ms = Date.now() - start;
    const status = ctx.status;

    // 根据状态码颜色化输出
    let statusColor = chalk.green;
    if (status >= 400) statusColor = chalk.yellow;
    if (status >= 500) statusColor = chalk.red;

    console.log(
      `[${new Date().toISOString()}] ${ctx.method} ${ctx.url} - ${statusColor(status)} - ${ms}ms`,
    );
  };
}
