import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import serve from 'koa-static';
import logger from './logger';
import errorHandler from './errorHandler';
import cors from './cors';
import config from '../config';

export default (app: Koa): void => {
  // 错误处理（第一层）
  app.use(errorHandler());

  // CORS
  app.use(cors());

  // 日志
  app.use(logger());

  // 请求体解析
  app.use(
    bodyParser({
      enableTypes: ['json', 'form', 'text'],
      jsonLimit: '10mb',
      formLimit: '10mb',
    }),
  );

  // 静态文件服务
  app.use(
    serve('public', {
      maxage: config.env === 'production' ? 86400000 : 0, // 生产环境缓存1天
    }),
  );
};
