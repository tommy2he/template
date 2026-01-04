// /routes/api/index.ts - 清理版
import Router from 'koa-router';
import os from 'os';

import {
  //eslint-disable-next-line
  getPerformanceMetrics,
  resetPerformanceMetrics,
} from '../../middleware/performance';
import deviceRoutes from './deviceRoutes';
import { CPEModel } from '../../db/schemas/cpe.schema';
import adminRoutes from './admin.routes';
import cpesRoutes from './cpes';

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

    // 修改：使用 onlineStatus 而不是 connectionStatus
    const online = await CPEModel.countDocuments({
      onlineStatus: 'online',
    });
    const offline = await CPEModel.countDocuments({
      onlineStatus: 'offline',
    });

    // 如果有些CPE还没有 onlineStatus（比如新设备），统计它们
    const withoutStatus = await CPEModel.countDocuments({
      onlineStatus: { $exists: false },
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
        withoutStatus, // 新增：还没有在线状态计算的设备数
        totalHeartbeats: heartbeatStats[0]?.totalHeartbeats || 0,
        onlinePercentage: total > 0 ? Math.round((online / total) * 100) : 0,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    //eslint-disable-next-line
    console.error('获取CPE统计错误:', error);
    ctx.status = 500;
    ctx.body = { error: 'Internal server error' };
  }
});

// 新增：获取连接状态统计（调试用）
router.get('/cpes/connection-stats', async (ctx) => {
  try {
    const total = await CPEModel.countDocuments({});
    const connected = await CPEModel.countDocuments({
      connectionStatus: 'connected',
    });
    const registered = await CPEModel.countDocuments({
      connectionStatus: 'registered',
    });
    const disconnected = await CPEModel.countDocuments({
      connectionStatus: 'disconnected',
    });
    const connecting = await CPEModel.countDocuments({
      connectionStatus: 'connecting',
    });

    ctx.body = {
      success: true,
      data: {
        total,
        connected,
        registered,
        disconnected,
        connecting,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    //eslint-disable-next-line
    console.error('获取连接统计错误:', error);
    ctx.status = 500;
    ctx.body = { error: 'Internal server error' };
  }
});

// 挂载管理员路由
router.use('/admin', adminRoutes.routes(), adminRoutes.allowedMethods());

// 挂载设备路由
router.use('/devices', deviceRoutes.routes(), deviceRoutes.allowedMethods());

// 挂载cpes路由
router.use('/cpes', cpesRoutes.routes(), cpesRoutes.allowedMethods());

export default router;
