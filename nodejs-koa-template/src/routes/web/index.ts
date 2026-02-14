// /src/routes/web/index.ts
import Router from 'koa-router';
import path from 'path';
import fs from 'fs';

const router = new Router();

// 主页面
router.get('/', async (ctx) => {
  ctx.type = 'html';
  ctx.body = fs.createReadStream(
    path.join(process.cwd(), 'public', 'index.html'),
  );
});

// CPE监控页面
router.get('/cpe/monitor', async (ctx) => {
  ctx.type = 'html';
  const monitorPath = path.join(process.cwd(), 'cpe', 'monitor', 'index.html');
  if (fs.existsSync(monitorPath)) {
    ctx.body = fs.createReadStream(monitorPath);
  } else {
    ctx.status = 404;
    ctx.body = 'CPE监控页面未找到';
  }
});

// UI管理员页面
router.get('/ui.html', async (ctx) => {
  ctx.type = 'html';
  const uiPath = path.join(process.cwd(), 'public', 'ui.html');
  if (fs.existsSync(uiPath)) {
    ctx.body = fs.createReadStream(uiPath);
  } else {
    ctx.status = 404;
    ctx.body = '管理员界面未找到';
  }
});

export default router;
