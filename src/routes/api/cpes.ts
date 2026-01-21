/* eslint-disable no-console */

// /src/routes/api/cpes.ts - 使用自定义上下文
import Router from 'koa-router';
import { CPEModel } from '../../db/schemas/cpe.schema';
import { Context } from 'koa';
import { WebSocketManager } from '../../websocket/server';
import { UDPClient } from '../../udp/client';

// 2.2版本新增 - Prometheus监控体系
import { cpeMetricsUpdater } from '../../monitor/services/cpe-metrics-updater';

export interface CustomContext extends Context {
  wsManager?: WebSocketManager;
  udpClient?: UDPClient;
}

// interface CustomContext extends Context {
//   wsManager?: WebSocketManager;
//   udpClient?: UDPClient;
// }

// interface CustomContext {
//   udpClient?: any;
//   wsManager?: any;
// }

// const router = new Router({ prefix: '/api/cpes' });
const router = new Router();

// 获取所有CPE（管理用）
router.get('/', async (ctx) => {
  // const customCtx = ctx as CustomContext;
  try {
    const { page = 1, limit = 20, status } = ctx.query;

    const query: any = {};
    if (status) query.onlineStatus = status;

    const skip = (Number(page) - 1) * Number(limit);

    const [cpes, total] = await Promise.all([
      CPEModel.find(query)
        .skip(skip)
        .limit(Number(limit))
        .sort({ lastSeen: -1 }),
      CPEModel.countDocuments(query),
    ]);

    ctx.body = {
      success: true,
      data: cpes,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    };
  } catch (error) {
    console.error('获取CPE列表错误:', error);
    ctx.status = 500;
    ctx.body = { error: 'Internal server error' };
  }
});

// 手动更新CPE指标
router.get('/metrics/update', async (ctx) => {
  // const customCtx = ctx as CustomContext;
  try {
    await cpeMetricsUpdater.updateMetrics();

    ctx.body = {
      success: true,
      message: 'CPE指标已手动更新',
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('手动更新CPE指标失败:', error);
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: (error as Error).message,
    };
  }
});

// 获取CPE指标状态
router.get('/metrics/status', async (ctx) => {
  // const customCtx = ctx as CustomContext;
  try {
    // 获取当前指标统计
    const total = await CPEModel.countDocuments({});

    // 计算在线数量（使用与更新器相同的逻辑）
    const timeoutMs = 30 * 60 * 1000; // 30分钟超时
    const cutoffTime = new Date(Date.now() - timeoutMs);
    const online = await CPEModel.countDocuments({
      lastSeen: { $gte: cutoffTime },
    });

    // 连接状态统计
    const connected = await CPEModel.countDocuments({
      connectionStatus: 'connected',
    });
    const registered = await CPEModel.countDocuments({
      connectionStatus: 'registered',
    });

    ctx.body = {
      success: true,
      data: {
        total,
        online,
        offline: total - online,
        connected,
        registered,
        onlinePercentage: total > 0 ? Math.round((online / total) * 100) : 0,
        prometheusMetric: 'cpe_online_total',
        description: '在线CPE数量（基于lastSeen时间）',
        timeoutSeconds: timeoutMs / 1000,
        lastUpdated: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('获取CPE指标状态失败:', error);
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: (error as Error).message,
    };
  }
});

// 获取Prometheus原始指标
router.get('/metrics/raw', async (ctx) => {
  // const customCtx = ctx as CustomContext;
  try {
    const metrics = await cpeMetricsUpdater.getRawMetrics();

    ctx.set('Content-Type', 'text/plain');
    ctx.body = metrics;
  } catch (error) {
    console.error('获取原始指标失败:', error);
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: (error as Error).message,
    };
  }
});

// 唤醒CPE（通过UDP）
router.post('/:cpeId/wakeup', async (ctx) => {
  const customCtx = ctx as CustomContext;
  try {
    const { cpeId } = ctx.params;
    const cpe = await CPEModel.findOne({ cpeId });

    if (!cpe) {
      ctx.status = 404;
      ctx.body = { error: 'CPE not found' };
      return;
    }

    // 如果没有IP地址，无法唤醒
    if (!cpe.ipAddress) {
      ctx.status = 400;
      ctx.body = { error: 'CPE has no IP address' };
      return;
    }

    // 通过UDP客户端发送唤醒包
    const udpClient = customCtx.udpClient;
    if (!udpClient) {
      ctx.status = 500;
      ctx.body = { error: 'UDP client not available' };
      return;
    }

    const success = await udpClient.wakeUpCPE(
      cpe.ipAddress,
      cpe.wakeupPort || 7548,
      {
        type: 'wakeup',
        command: 'connectToACS',
        acsUrl: 'ws://localhost:7547',
        timestamp: Date.now(),
        cpeId,
      },
    );

    if (success) {
      // 更新最后唤醒时间
      await CPEModel.findOneAndUpdate(
        { cpeId },
        { lastWakeupCall: new Date() },
      );

      ctx.body = {
        success: true,
        message: `Wakeup signal sent to ${cpe.ipAddress}:${cpe.wakeupPort || 7548}`,
        delivered: true,
        timestamp: new Date().toISOString(),
      };
    } else {
      ctx.body = {
        success: false,
        message: 'Failed to send wakeup signal',
        delivered: false,
        timestamp: new Date().toISOString(),
      };
    }
  } catch (error) {
    console.error('唤醒CPE错误:', error);
    ctx.status = 500;
    ctx.body = { error: 'Internal server error' };
  }
});

// 向CPE下发配置（通过WebSocket）
router.post('/:cpeId/configuration', async (ctx) => {
  const customCtx = ctx as CustomContext;
  try {
    const { cpeId } = ctx.params;
    const configuration = ctx.request.body as Record<string, any>;

    const wsManager = customCtx.wsManager;
    if (!wsManager) {
      ctx.status = 500;
      ctx.body = { error: 'WebSocket manager not available' };
      return;
    }

    // 发送配置更新消息
    const sent = wsManager.sendToCPE(cpeId, {
      type: 'setParameterValues',
      timestamp: Date.now(),
      data: {
        parameters: configuration,
      },
    });

    if (sent) {
      // 保存为待处理配置
      await CPEModel.updateOne({ cpeId }, { pendingConfig: configuration });

      ctx.body = {
        success: true,
        message: 'Configuration sent via WebSocket',
        delivered: true,
      };
    } else {
      // CPE不在线，保存到待处理配置
      await CPEModel.updateOne({ cpeId }, { pendingConfig: configuration });

      ctx.body = {
        success: true,
        message: 'Configuration queued (CPE offline)',
        delivered: false,
      };
    }
  } catch (error) {
    console.error('下发配置错误:', error);
    ctx.status = 500;
    ctx.body = { error: 'Internal server error' };
  }
});

// 断开CPE连接（管理用）
router.post('/:cpeId/disconnect', async (ctx) => {
  const customCtx = ctx as CustomContext;
  try {
    const { cpeId } = ctx.params;
    const wsManager = customCtx.wsManager;

    if (wsManager) {
      // 发送断开连接消息
      wsManager.sendToCPE(cpeId, {
        type: 'disconnect',
        reason: 'Admin request',
        timestamp: Date.now(),
      });
    }

    // 更新状态
    await CPEModel.updateOne({ cpeId }, { connectionStatus: 'disconnected' });

    ctx.body = {
      success: true,
      message: 'Disconnect request sent',
    };
  } catch (error) {
    console.error('断开连接错误:', error);
    ctx.status = 500;
    ctx.body = { error: 'Internal server error' };
  }
});

// 在现有路由后添加测试端点

/**
 * 获取原始指标（基于数据库字段）
 * GET /api/cpes/metrics/raw
 */
router.get('/metrics/raw', async (ctx) => {
  try {
    const metrics = await cpeMetricsUpdater.getRawMetrics();
    ctx.set('Content-Type', 'text/plain');
    ctx.body = metrics;
  } catch (error) {
    console.error('获取原始指标失败:', error);
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: (error as Error).message,
    };
  }
});

/**
 * 获取实时计算指标（用于测试对比）
 * GET /api/cpes/metrics/realtime
 */
router.get('/metrics/realtime', async (ctx) => {
  try {
    const metrics = await cpeMetricsUpdater.getRealtimeMetrics();
    ctx.set('Content-Type', 'text/plain');
    ctx.body = metrics;
  } catch (error) {
    console.error('获取实时指标失败:', error);
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: (error as Error).message,
    };
  }
});

/**
 * 获取实时对比统计（JSON格式）
 * GET /api/cpes/metrics/compare
 */
router.get('/metrics/compare', async (ctx) => {
  try {
    const stats = await cpeMetricsUpdater.getRealtimeStats();

    ctx.body = {
      success: true,
      data: {
        ...stats,
        description: '实时计算 vs 数据库onlineStatus字段对比',
        note: '实时计算基于lastSeen时间，数据库字段基于onlineStatus',
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('获取对比统计失败:', error);
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: (error as Error).message,
    };
  }
});

export default router;
