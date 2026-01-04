// src/routes/api/admin.routes.ts
/* eslint-disable no-console */
import Router from 'koa-router';
import { statusRefreshService } from '../../services/status-refresh.service';

const router = new Router({ prefix: '/api/admin' });

/**
 * 启动状态刷新任务
 * POST /api/admin/refresh-tasks
 * Body: { mode: 'normal'|'force', operator?: string }
 */
router.post('/refresh-tasks', async (ctx) => {
  try {
    const { mode = 'normal', operator = 'system' } = ctx.request.body as any;

    // 验证参数
    if (!['normal', 'force'].includes(mode)) {
      ctx.status = 400;
      ctx.body = {
        success: false,
        error: 'mode 参数必须是 "normal" 或 "force"',
      };
      return;
    }

    // 启动刷新任务
    const task = await statusRefreshService.startRefreshTask(mode, operator);

    ctx.status = 201;
    ctx.body = {
      success: true,
      message: '状态刷新任务已启动',
      data: task,
    };
  } catch (error: any) {
    console.error('启动刷新任务失败:', error);

    ctx.status = error.message?.includes('普通模式刷新限制') ? 429 : 500;
    ctx.body = {
      success: false,
      error: error.message,
    };
  }
});

/**
 * 获取任务详情
 * GET /api/admin/refresh-tasks/:taskId
 */
router.get('/refresh-tasks/:taskId', async (ctx) => {
  try {
    const { taskId } = ctx.params;
    const task = await statusRefreshService.getTask(taskId);

    if (!task) {
      ctx.status = 404;
      ctx.body = {
        success: false,
        error: '任务不存在',
      };
      return;
    }

    ctx.body = {
      success: true,
      data: task,
    };
  } catch (error: any) {
    console.error('获取任务详情失败:', error);
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: error.message,
    };
  }
});

/**
 * 获取最近任务列表
 * GET /api/admin/refresh-tasks
 * Query: ?limit=10&status=running
 */
router.get('/refresh-tasks', async (ctx) => {
  try {
    const { limit = 10, status } = ctx.query;

    const query: any = {};
    if (status) {
      query.status = status;
    }

    // 这里简单实现，实际应该使用查询条件
    const tasks = await statusRefreshService.getRecentTasks(
      parseInt(limit as string),
    );

    // 获取任务统计
    const stats = await statusRefreshService.getTaskStats();

    ctx.body = {
      success: true,
      data: {
        tasks,
        stats,
      },
    };
  } catch (error: any) {
    console.error('获取任务列表失败:', error);
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: error.message,
    };
  }
});

/**
 * 获取最新任务
 * GET /api/admin/refresh-tasks/latest
 */
router.get('/refresh-tasks/latest', async (ctx) => {
  try {
    const task = await statusRefreshService.getLatestTask();

    ctx.body = {
      success: true,
      data: task,
    };
  } catch (error: any) {
    console.error('获取最新任务失败:', error);
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: error.message,
    };
  }
});

/**
 * 取消任务
 * POST /api/admin/refresh-tasks/:taskId/cancel
 */
router.post('/refresh-tasks/:taskId/cancel', async (ctx) => {
  try {
    const { taskId } = ctx.params;
    const cancelled = await statusRefreshService.cancelTask(taskId);

    ctx.body = {
      success: true,
      message: '任务已取消',
      data: { cancelled },
    };
  } catch (error: any) {
    console.error('取消任务失败:', error);

    const status = error.message?.includes('不存在')
      ? 404
      : error.message?.includes('无法取消')
        ? 400
        : 500;

    ctx.status = status;
    ctx.body = {
      success: false,
      error: error.message,
    };
  }
});

/**
 * 获取任务统计
 * GET /api/admin/refresh-tasks/stats
 */
router.get('/refresh-tasks/stats', async (ctx) => {
  try {
    const stats = await statusRefreshService.getTaskStats();

    ctx.body = {
      success: true,
      data: stats,
    };
  } catch (error: any) {
    console.error('获取任务统计失败:', error);
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: error.message,
    };
  }
});

/**
 * 清理旧任务（管理用）
 * POST /api/admin/refresh-tasks/cleanup
 * Body: { daysToKeep: 30 }
 */
router.post('/refresh-tasks/cleanup', async (ctx) => {
  try {
    const { daysToKeep = 30 } = ctx.request.body as any;
    const deletedCount = await statusRefreshService.cleanupOldTasks(daysToKeep);

    ctx.body = {
      success: true,
      message: `清理了 ${deletedCount} 个旧任务`,
      data: { deletedCount },
    };
  } catch (error: any) {
    console.error('清理旧任务失败:', error);
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: error.message,
    };
  }
});

/**
 * 检查是否可以刷新
 * GET /api/admin/refresh-tasks/check
 * 用于前端检查当前是否可以执行normal模式刷新
 */
router.get('/refresh-tasks/check', async (ctx) => {
  try {
    // 获取最新任务
    const latestTask = await statusRefreshService.getLatestTask();

    let canRefresh = true;
    let message = '可以执行刷新';
    let lastRefreshTime: Date | null = null;
    let minutesSinceLastRefresh: number | null = null;

    if (latestTask?.status === 'completed') {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      lastRefreshTime = latestTask.startedAt;
      minutesSinceLastRefresh = Math.floor(
        (Date.now() - lastRefreshTime.getTime()) / 60000,
      );

      if (lastRefreshTime > fiveMinutesAgo) {
        canRefresh = false;
        const minutesLeft = 5 - minutesSinceLastRefresh;
        message = `距离上次刷新仅 ${minutesSinceLastRefresh} 分钟，请 ${minutesLeft} 分钟后再试或使用强制模式`;
      }
    }

    ctx.body = {
      success: true,
      data: {
        canRefresh,
        message,
        lastRefreshTime,
        minutesSinceLastRefresh,
        latestTask: latestTask
          ? {
              taskId: latestTask.taskId,
              mode: latestTask.mode,
              status: latestTask.status,
              startedAt: latestTask.startedAt,
              completedAt: latestTask.completedAt,
            }
          : null,
      },
    };
  } catch (error: any) {
    console.error('检查刷新状态失败:', error);
    ctx.status = 500;
    ctx.body = {
      success: false,
      error: error.message,
    };
  }
});

export default router;
