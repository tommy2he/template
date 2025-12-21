import Router from 'koa-router';

const router = new Router();

router.get('/', async (ctx) => {
  ctx.body = { message: 'Hello from API!' };
});

router.get('/health', async (ctx) => {
  ctx.body = { status: 'OK' };
});

export default router;
