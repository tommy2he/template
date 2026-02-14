// src/services/status-refresh.service.ts
/* eslint-disable no-console */
import { CPEModel } from '../db/schemas/cpe.schema';
import {
  RefreshTaskModel,
  IRefreshTask,
} from '../db/schemas/refresh-task.schema';
import { StatusCalculator } from './status-calculator';
import config from '../config';
// import { cpeMetrics } from '../monitor/prometheus/metrics';
import { cpeMetricsUpdater } from '../monitor/services/cpe-metrics-updater'; // 如果创建了这个服务

export class StatusRefreshService {
  private static instance: StatusRefreshService;
  private activeTasks: Map<string, boolean> = new Map();

  private constructor() {}

  static getInstance(): StatusRefreshService {
    if (!StatusRefreshService.instance) {
      StatusRefreshService.instance = new StatusRefreshService();
    }
    return StatusRefreshService.instance;
  }

  /**
   * 检查是否可以执行普通模式刷新
   */
  private async canRunNormalMode(): Promise<{
    canRun: boolean;
    lastRefresh?: Date;
    message?: string;
  }> {
    try {
      // 查找最近完成的刷新任务
      const lastTask = await RefreshTaskModel.findOne({
        status: 'completed',
        mode: 'normal',
      }).sort({ startedAt: -1 });

      if (!lastTask) {
        return { canRun: true };
      }

      // 检查距离上次刷新是否超过5分钟
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const lastRefreshTime = lastTask.startedAt;

      if (lastRefreshTime > fiveMinutesAgo) {
        const minutesAgo = Math.floor(
          (Date.now() - lastRefreshTime.getTime()) / 60000,
        );
        const minutesLeft = 5 - minutesAgo;

        return {
          canRun: false,
          lastRefresh: lastRefreshTime,
          message: `距离上次普通模式刷新仅 ${minutesAgo} 分钟，请 ${minutesLeft} 分钟后再试或使用强制模式`,
        };
      }

      return { canRun: true };
    } catch (error) {
      console.error('检查普通模式失败:', error);
      return { canRun: true }; // 出错时允许执行，避免阻塞
    }
  }

  /**
   * 生成任务ID
   */
  private generateTaskId(): string {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `refresh-${dateStr}-${timeStr}-${randomStr}`;
  }

  /**
   * 启动状态刷新任务
   */
  async startRefreshTask(
    mode: 'normal' | 'force' = 'normal',
    operator: string = 'system',
  ): Promise<IRefreshTask> {
    console.log(`🔄 启动状态刷新任务，模式: ${mode}, 操作员: ${operator}`);

    // 检查模式限制
    if (mode === 'normal') {
      const checkResult = await this.canRunNormalMode();
      if (!checkResult.canRun) {
        throw new Error(checkResult.message || '普通模式刷新限制未通过');
      }
    }

    // 生成任务ID
    const taskId = this.generateTaskId();

    // 创建任务记录
    const taskData = {
      taskId,
      mode,
      status: 'pending' as const,
      progress: 0,
      totalDevices: 0,
      processedDevices: 0,
      operator,
      onlineCount: 0,
      offlineCount: 0,
      startedAt: new Date(),
    };

    const task = await RefreshTaskModel.create(taskData);
    console.log(`📝 创建刷新任务: ${taskId}`);

    // 异步启动任务处理（不阻塞响应）
    this.processRefreshTask(taskId).catch((error) => {
      console.error(`❌ 任务 ${taskId} 处理失败:`, error);
    });

    return task;
  }

  /**
   * 处理刷新任务（核心逻辑）
   */
  private async processRefreshTask(taskId: string): Promise<void> {
    // 防止重复处理同一任务
    if (this.activeTasks.has(taskId)) {
      console.warn(`⚠️ 任务 ${taskId} 已在处理中，跳过`);
      return;
    }

    this.activeTasks.set(taskId, true);
    console.log(`▶️ 开始处理任务: ${taskId}`);

    try {
      // 获取任务记录
      const task = await RefreshTaskModel.findOne({ taskId });
      if (!task) {
        throw new Error(`任务 ${taskId} 不存在`);
      }

      // 更新状态为运行中
      task.status = 'running';
      await task.save();

      // 获取总设备数
      const totalDevices = await CPEModel.countDocuments();
      task.totalDevices = totalDevices;
      await task.save();

      console.log(`📊 总设备数: ${totalDevices}`);

      if (totalDevices === 0) {
        // 没有设备，直接完成
        task.status = 'completed';
        task.progress = 100;
        task.completedAt = new Date();
        await task.save();
        console.log(`✅ 任务 ${taskId} 完成（无设备）`);
        return;
      }

      // 使用分页批量计算
      const batchSize = config.cpeManagement.refreshBatchSize;
      const totalPages = Math.ceil(totalDevices / batchSize);
      let processedDevices = 0;
      let onlineCount = 0;
      let offlineCount = 0;

      console.log(`📦 使用批量大小: ${batchSize}, 总页数: ${totalPages}`);

      for (let page = 0; page < totalPages; page++) {
        // 检查任务是否被取消
        const currentTask = await RefreshTaskModel.findOne({ taskId });
        if (currentTask?.status === 'cancelled') {
          console.log(`🛑 任务 ${taskId} 已被取消`);
          break;
        }

        // 获取当前批次设备
        const devices = await CPEModel.find()
          .skip(page * batchSize)
          .limit(batchSize)
          .select('_id lastSeen onlineStatus'); // 只选择需要的字段，减少内存占用

        // 计算批次统计
        let batchOnline = 0;
        let batchOffline = 0;
        const updateOperations = [];

        for (const device of devices) {
          const onlineStatus = StatusCalculator.calculateOnlineStatus(device);

          if (device.onlineStatus !== onlineStatus) {
            updateOperations.push({
              updateOne: {
                filter: { _id: device._id },
                update: {
                  onlineStatus,
                  onlineStatusUpdatedAt: new Date(),
                },
              },
            });
          }

          if (onlineStatus === 'online') {
            // eslint-disable-next-line
            batchOnline++;
            onlineCount++;
          } else {
            // eslint-disable-next-line
            batchOffline++;
            offlineCount++;
          }

          processedDevices++;
        }

        // 批量更新数据库（性能优化）
        if (updateOperations.length > 0) {
          await CPEModel.bulkWrite(updateOperations, { ordered: false });
        }

        // 更新任务进度
        const progress = Math.round((processedDevices / totalDevices) * 100);

        await RefreshTaskModel.updateOne(
          { taskId },
          {
            $set: {
              processedDevices,
              onlineCount,
              offlineCount,
              progress,
              updatedAt: new Date(),
            },
          },
        );

        // 计算预估剩余时间（首次迭代后）
        if (page === 1) {
          const elapsedMs = Date.now() - task.startedAt.getTime();
          const estimatedTotalMs =
            (elapsedMs / processedDevices) * totalDevices;
          const estimatedRemainingMs = estimatedTotalMs - elapsedMs;

          await RefreshTaskModel.updateOne(
            { taskId },
            {
              $set: {
                estimatedTimeRemaining: Math.max(
                  0,
                  Math.round(estimatedRemainingMs / 1000),
                ),
              },
            },
          );
        }

        // 进度日志
        const progressPercent = Math.round(
          (processedDevices / totalDevices) * 100,
        );
        console.log(
          `📊 任务 ${taskId} 进度: ${progressPercent}% - ` +
            `第 ${page + 1}/${totalPages} 页 (${processedDevices}/${totalDevices}) - ` +
            `在线: ${onlineCount}, 离线: ${offlineCount}`,
        );

        // 如果批量大小很小（比如5），添加延迟以便观察进度
        if (batchSize <= 5) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      // 标记任务完成
      task.status = 'completed';
      task.progress = 100;
      task.processedDevices = processedDevices;
      task.onlineCount = onlineCount;
      task.offlineCount = offlineCount;
      task.completedAt = new Date();
      task.estimatedTimeRemaining = 0;
      await task.save();

      // 2.2版本新增：立即更新CPE指标
      console.log('🔄 任务完成，更新CPE指标...');
      await cpeMetricsUpdater.updateMetrics(); // 或者直接更新指标

      console.log(`✅ 任务 ${taskId} 完成:`);
      console.log(`   总设备: ${totalDevices}`);
      console.log(
        `   在线: ${onlineCount} (${totalDevices > 0 ? Math.round((onlineCount / totalDevices) * 100) : 0}%)`,
      );
      console.log(
        `   离线: ${offlineCount} (${totalDevices > 0 ? Math.round((offlineCount / totalDevices) * 100) : 0}%)`,
      );
      console.log(
        `   耗时: ${Math.round((task.completedAt.getTime() - task.startedAt.getTime()) / 1000)} 秒`,
      );
    } catch (error: any) {
      console.error(`❌ 任务 ${taskId} 执行失败:`, error);

      // 更新任务为失败状态
      await RefreshTaskModel.updateOne(
        { taskId },
        {
          $set: {
            status: 'failed',
            error: error.message,
            errorDetails: error.stack,
            updatedAt: new Date(),
          },
        },
      );

      throw error;
    } finally {
      // 清理活动任务标记
      this.activeTasks.delete(taskId);
      console.log(`🔚 任务 ${taskId} 处理结束`);
    }
  }

  /**
   * 获取任务详情
   */
  async getTask(taskId: string): Promise<IRefreshTask | null> {
    return await RefreshTaskModel.findOne({ taskId });
  }

  /**
   * 获取最新任务
   */
  async getLatestTask(): Promise<IRefreshTask | null> {
    return await RefreshTaskModel.findOne().sort({ startedAt: -1 });
  }

  /**
   * 获取最近的任务列表
   */
  async getRecentTasks(limit: number = 10): Promise<IRefreshTask[]> {
    return await RefreshTaskModel.find()
      .sort({ startedAt: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * 取消正在运行的任务
   */
  async cancelTask(taskId: string): Promise<boolean> {
    const task = await RefreshTaskModel.findOne({ taskId });

    if (!task) {
      throw new Error(`任务 ${taskId} 不存在`);
    }

    if (task.status !== 'running') {
      throw new Error(`任务 ${taskId} 当前状态为 ${task.status}，无法取消`);
    }

    task.status = 'cancelled';
    await task.save();

    console.log(`🛑 任务 ${taskId} 已标记为取消`);
    return true;
  }

  /**
   * 获取任务统计信息
   */
  async getTaskStats(): Promise<{
    total: number;
    completed: number;
    running: number;
    failed: number;
    cancelled: number;
    averageDuration?: number;
  }> {
    const tasks = await RefreshTaskModel.find();

    let totalDuration = 0;
    let completedCount = 0;

    const stats = {
      total: tasks.length,
      completed: 0,
      running: 0,
      failed: 0,
      cancelled: 0,
      averageDuration: 0,
    };

    for (const task of tasks) {
      switch (task.status) {
        case 'completed':
          stats.completed++;
          if (task.startedAt && task.completedAt) {
            totalDuration +=
              task.completedAt.getTime() - task.startedAt.getTime();
            completedCount++;
          }
          break;
        case 'running':
          stats.running++;
          break;
        case 'failed':
          stats.failed++;
          break;
        case 'cancelled':
          stats.cancelled++;
          break;
      }
    }

    if (completedCount > 0) {
      stats.averageDuration = Math.round(totalDuration / completedCount / 1000); // 转换为秒
    }

    return stats;
  }

  /**
   * 清理旧的任务记录（保留最近30天）
   */
  async cleanupOldTasks(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

    const result = await RefreshTaskModel.deleteMany({
      startedAt: { $lt: cutoffDate },
      status: { $in: ['completed', 'failed', 'cancelled'] },
    });

    console.log(
      `🧹 清理了 ${result.deletedCount} 个超过 ${daysToKeep} 天的旧任务`,
    );
    return result.deletedCount || 0;
  }
}

// 导出单例实例
export const statusRefreshService = StatusRefreshService.getInstance();
