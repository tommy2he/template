import Koa from 'koa';
import Router from 'koa-router';
import apiRoutes from './api';
import webRoutes from './web';

export default (app: Koa): void => {
  const router = new Router();

  // API路由
  router.use('/api', apiRoutes.routes(), apiRoutes.allowedMethods());

  // Web路由
  router.use('/', webRoutes.routes(), webRoutes.allowedMethods());

  app.use(router.routes()).use(router.allowedMethods());
};
