// src/middleware/index.ts
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import serve from 'koa-static';
import logger from './logger';
import errorHandler from './errorHandler';

export default (app: Koa): void => {
  // 错误处理（第一层）
  app.use(errorHandler());

  // 日志
  app.use(logger());

  // 请求体解析
  app.use(
    bodyParser({
      enableTypes: ['json', 'form', 'text'],
    }),
  );

  // 静态文件服务
  app.use(serve('public'));
};
