// /routes/api/index.ts - 清理版
import Router from 'koa-router';
import os from 'os';
import {
  getPerformanceMetrics,
  resetPerformanceMetrics,
} from '../../middleware/performance';
import deviceRoutes from './deviceRoutes';
import { CPEModel } from '../../db/schemas/cpe.schema';
import adminRoutes from './admin.routes';

const router = new Router();

// API根路径
router.get('/', async (ctx) => {
  ctx.body = {
    message: 'Hello from API!',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  };
});

// 健康检查
router.get('/health', async (ctx) => {
  ctx.body = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: os.loadavg(),
    environment: process.env.NODE_ENV || 'development',
  };
});

// 应用状态
router.get('/status', async (ctx) => {
  ctx.body = {
    app: 'Koa Template App',
    version: '1.0.0',
    status: 'running',
    endpoints: ['/api', '/api/health', '/api/status', '/api/echo/:message'],
  };
});

// 消息回显
router.get('/echo/:message', async (ctx) => {
  const { message } = ctx.params;
  const { repeat = '1' } = ctx.query;

  const repeatedMessage = message.repeat(parseInt(repeat as string) || 1);

  ctx.body = {
    original: message,
    repeated: repeatedMessage,
    length: repeatedMessage.length,
    echoedAt: new Date().toISOString(),
  };
});

// POST消息回显
router.post('/echo', async (ctx) => {
  const { message, timestamp } = ctx.request.body as any;

  ctx.body = {
    received: {
      message,
      timestamp: timestamp || new Date().toISOString(),
    },
    processedAt: new Date().toISOString(),
    serverInfo: {
      nodeVersion: process.version,
      platform: process.platform,
    },
  };
});

// 速率限制测试端点
router.get('/rate-limit-test', async (ctx) => {
  ctx.body = {
    message: '速率限制测试端点',
    timestamp: new Date().toISOString(),
    requestCount: 1,
  };
});

// 性能指标端点
router.get('/performance', getPerformanceMetrics());

// 重置性能指标
router.post('/performance/reset', resetPerformanceMetrics());

// 详细健康检查
router.get('/performance/health', async (ctx) => {
  const memory = process.memoryUsage();
  const cpus = os.cpus();

  ctx.body = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    process: {
      uptime: process.uptime(),
      memory: {
        rss: `${(memory.rss / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(memory.heapTotal / 1024 / 1024).toFixed(2)} MB`,
        heapUsed: `${(memory.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        external: `${(memory.external / 1024 / 1024).toFixed(2)} MB`,
      },
      pid: process.pid,
      version: process.version,
      platform: process.platform,
    },
    system: {
      cpus: cpus.length,
      loadAvg: os.loadavg(),
      freemem: `${(os.freemem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
      totalmem: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`,
      uptime: os.uptime(),
    },
  };
});

// 添加CPE统计信息路由
router.get('/cpes/stats', async (ctx) => {
  try {
    const total = await CPEModel.countDocuments({});
    const online = await CPEModel.countDocuments({
      connectionStatus: { $in: ['connected', 'registered'] },
    });
    const offline = await CPEModel.countDocuments({
      connectionStatus: 'disconnected',
    });

    // 计算总心跳数
    const heartbeatStats = await CPEModel.aggregate([
      { $group: { _id: null, totalHeartbeats: { $sum: '$heartbeatCount' } } },
    ]);

    ctx.body = {
      success: true,
      data: {
        total,
        online,
        offline,
        totalHeartbeats: heartbeatStats[0]?.totalHeartbeats || 0,
        onlinePercentage: total > 0 ? Math.round((online / total) * 100) : 0,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('获取CPE统计错误:', error);
    ctx.status = 500;
    ctx.body = { error: 'Internal server error' };
  }
});

// 挂载管理员路由
router.use('/admin', adminRoutes.routes(), adminRoutes.allowedMethods());

// 挂载设备路由
router.use('/devices', deviceRoutes.routes(), deviceRoutes.allowedMethods());

export default router;
