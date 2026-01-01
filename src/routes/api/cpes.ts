import Router from 'koa-router';
import { CPEModel } from '../../db/schemas/cpe.schema';
import jwt from 'jsonwebtoken';

const router = new Router({ prefix: '/api/cpes' });

// CPE注册接口
router.post('/register', async (ctx) => {
  try {
    const {
      deviceId,
      cpeId,
      capabilities = [],
      metadata = {},
    } = ctx.request.body;

    // 验证必填字段
    if (!deviceId || !cpeId) {
      ctx.status = 400;
      ctx.body = { error: 'deviceId and cpeId are required' };
      return;
    }

    // 检查是否已注册
    let cpe = await CPEModel.findOne({ cpeId });

    if (cpe) {
      // 更新现有CPE
      cpe = await CPEModel.findOneAndUpdate(
        { cpeId },
        {
          deviceId,
          capabilities,
          metadata,
          connectionStatus: 'registered',
          lastSeen: new Date(),
        },
        { new: true },
      );
    } else {
      // 创建新CPE
      cpe = await CPEModel.create({
        deviceId,
        cpeId,
        capabilities,
        metadata,
        connectionStatus: 'registered',
        configuration: {},
        heartbeatInterval: 30,
      });
    }

    // 生成JWT令牌用于WebSocket连接
    const token = jwt.sign(
      { cpeId, deviceId },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '7d' },
    );

    // WebSocket连接URL
    const wsUrl = process.env.WS_URL || `ws://${ctx.request.host}`;
    const wsConnectionUrl = `${wsUrl}?token=${token}&cpeId=${cpeId}`;

    ctx.status = 201;
    ctx.body = {
      success: true,
      cpeId: cpe.cpeId,
      token,
      wsConnectionUrl,
      heartbeatInterval: cpe.heartbeatInterval,
      message: 'CPE registered successfully',
    };
  } catch (error) {
    console.error('CPE registration error:', error);
    ctx.status = 500;
    ctx.body = { error: 'Internal server error' };
  }
});

// CPE心跳接口
router.post('/:cpeId/heartbeat', async (ctx) => {
  try {
    const { cpeId } = ctx.params;
    const { status, metrics } = ctx.request.body;

    const cpe = await CPEModel.findOneAndUpdate(
      { cpeId },
      {
        lastHeartbeat: new Date(),
        lastSeen: new Date(),
        ...(status && { connectionStatus: status }),
        ...(metrics && { metadata: { ...metrics } }),
      },
      { new: true },
    );

    if (!cpe) {
      ctx.status = 404;
      ctx.body = { error: 'CPE not found' };
      return;
    }

    ctx.body = {
      success: true,
      cpeId: cpe.cpeId,
      nextHeartbeatIn: cpe.heartbeatInterval,
      hasPendingConfiguration: !!cpe.pendingConfiguration,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Heartbeat error:', error);
    ctx.status = 500;
    ctx.body = { error: 'Internal server error' };
  }
});

// 获取CPE列表
router.get('/', async (ctx) => {
  try {
    const { status, page = 1, limit = 20 } = ctx.query;

    const query: any = {};
    if (status) query.connectionStatus = status;

    const skip = (Number(page) - 1) * Number(limit);

    const [cpes, total] = await Promise.all([
      CPEModel.find(query)
        .skip(skip)
        .limit(Number(limit))
        .sort({ lastSeen: -1 }),
      CPEModel.countDocuments(query),
    ]);

    ctx.body = {
      data: cpes,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    };
  } catch (error) {
    console.error('Get CPEs error:', error);
    ctx.status = 500;
    ctx.body = { error: 'Internal server error' };
  }
});

// 获取单个CPE
router.get('/:cpeId', async (ctx) => {
  try {
    const { cpeId } = ctx.params;

    const cpe = await CPEModel.findOne({ cpeId });

    if (!cpe) {
      ctx.status = 404;
      ctx.body = { error: 'CPE not found' };
      return;
    }

    ctx.body = cpe;
  } catch (error) {
    console.error('Get CPE error:', error);
    ctx.status = 500;
    ctx.body = { error: 'Internal server error' };
  }
});

// 向CPE下发配置
router.post('/:cpeId/configuration', async (ctx) => {
  try {
    const { cpeId } = ctx.params;
    const configuration = ctx.request.body;

    const cpe = await CPEModel.findOneAndUpdate(
      { cpeId },
      { pendingConfiguration: configuration },
      { new: true },
    );

    if (!cpe) {
      ctx.status = 404;
      ctx.body = { error: 'CPE not found' };
      return;
    }

    // 尝试通过WebSocket实时推送配置
    // 这里需要注入WebSocketManager实例
    const wsManager = (ctx as any).wsManager;
    if (wsManager) {
      const sent = await wsManager.sendToCPE(cpeId, {
        type: 'configuration_update',
        configuration,
        timestamp: new Date().toISOString(),
      });

      if (sent) {
        ctx.body = {
          success: true,
          message: 'Configuration sent via WebSocket',
          delivered: true,
        };
        return;
      }
    }

    // 如果WebSocket不可用，CPE将在下次心跳时获取配置
    ctx.body = {
      success: true,
      message: 'Configuration queued for next heartbeat',
      delivered: false,
    };
  } catch (error) {
    console.error('Configuration error:', error);
    ctx.status = 500;
    ctx.body = { error: 'Internal server error' };
  }
});

// 断开CPE连接（管理端）
router.post('/:cpeId/disconnect', async (ctx) => {
  try {
    const { cpeId } = ctx.params;

    // 更新数据库状态
    await CPEModel.findOneAndUpdate(
      { cpeId },
      { connectionStatus: 'offline', wsConnectionId: null },
    );

    // 通过WebSocket断开连接
    const wsManager = (ctx as any).wsManager;
    if (wsManager) {
      await wsManager.sendToCPE(cpeId, {
        type: 'disconnect',
        reason: 'Admin requested',
        timestamp: new Date().toISOString(),
      });
    }

    ctx.body = {
      success: true,
      message: 'Disconnect request sent',
    };
  } catch (error) {
    console.error('Disconnect error:', error);
    ctx.status = 500;
    ctx.body = { error: 'Internal server error' };
  }
});

export default router;
