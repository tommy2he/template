// /routes/index.ts - 清理版
import Koa from 'koa';
import Router from 'koa-router';
import apiRoutes from './api';
import webRoutes from './web';

// 导入Swagger相关
import { swaggerJSON } from '../middleware/swagger';
import config from '../config';

export default (app: Koa): void => {
  const router = new Router();

  // API路由
  router.use('/api', apiRoutes.routes(), apiRoutes.allowedMethods());

  // Web路由
  router.use('/', webRoutes.routes(), webRoutes.allowedMethods());

  // Swagger JSON 路由
  if (config.enableSwagger) {
    router.get('/swagger.json', swaggerJSON());
  }

  app.use(router.routes()).use(router.allowedMethods());

  // console.log('✅ 路由加载完成');
};
