// src/services/status-calculator.ts
/* eslint-disable no-console */
import { CPEModel, ICPE } from '../db/schemas/cpe.schema';
import config from '../config';

export class StatusCalculator {
  /**
   * 计算单个CPE的在线状态
   */
  static calculateOnlineStatus(cpe: ICPE): 'online' | 'offline' {
    const now = new Date();
    const lastSeen = cpe.lastSeen;
    const timeoutMs = config.cpeManagement.onlineTimeout; // 从配置读取

    if (!lastSeen) {
      return 'offline';
    }

    const timeDiff = now.getTime() - lastSeen.getTime();
    return timeDiff <= timeoutMs ? 'online' : 'offline';
  }

  /**
   * 批量计算CPE在线状态（基础版本）
   */
  static async calculateBatch(): Promise<{
    total: number;
    processed: number;
    online: number;
    offline: number;
  }> {
    console.log('🔄 开始批量计算CPE在线状态...');

    const cpes = await CPEModel.find({});
    const total = cpes.length;
    let online = 0;
    let offline = 0;
    let processed = 0;

    for (const cpe of cpes) {
      try {
        const onlineStatus = this.calculateOnlineStatus(cpe);

        // 只有当状态发生变化时才更新
        if (cpe.onlineStatus !== onlineStatus) {
          await CPEModel.updateOne(
            { _id: cpe._id },
            {
              onlineStatus,
              onlineStatusUpdatedAt: new Date(),
            },
          );
        }

        if (onlineStatus === 'online') online++;
        else offline++;

        processed++;

        // 每处理100个设备打印一次进度
        if (processed % 100 === 0) {
          console.log(`📊 已处理 ${processed}/${total} 个设备`);
        }
      } catch (error) {
        console.error(`❌ 处理CPE ${cpe.cpeId} 时出错:`, error);
      }
    }

    console.log(
      `✅ 批量计算完成: 总设备 ${total}, 在线 ${online}, 离线 ${offline}`,
    );

    return { total, processed, online, offline };
  }

  /**
   * 分页批量计算（性能优化版本，支持大规模设备）
   */
  static async calculateBatchPaginated(): Promise<{
    total: number;
    processed: number;
    online: number;
    offline: number;
    pages: number;
    batchSize: number;
  }> {
    console.log('🔄 开始分页批量计算CPE在线状态...');

    const batchSize = config.cpeManagement.refreshBatchSize;
    console.log(`📦 批量大小: ${batchSize} 个设备/批次`);

    const total = await CPEModel.countDocuments({});
    const pages = Math.ceil(total / batchSize);
    let processed = 0;
    let online = 0;
    let offline = 0;

    for (let page = 0; page < pages; page++) {
      try {
        const cpes = await CPEModel.find({})
          .skip(page * batchSize)
          .limit(batchSize);

        const bulkOps = [];

        for (const cpe of cpes) {
          const onlineStatus = this.calculateOnlineStatus(cpe);

          if (cpe.onlineStatus !== onlineStatus) {
            bulkOps.push({
              updateOne: {
                filter: { _id: cpe._id },
                update: {
                  $set: {
                    onlineStatus,
                    onlineStatusUpdatedAt: new Date(),
                  },
                },
              },
            });
          }

          if (onlineStatus === 'online') online++;
          else offline++;
        }

        // 批量更新数据库（性能优化）
        if (bulkOps.length > 0) {
          await CPEModel.bulkWrite(bulkOps);
        }

        processed += cpes.length;

        // 显示进度信息
        const progressPercent = Math.round((processed / total) * 100);
        console.log(
          `📊 进度: ${progressPercent}% - 第 ${page + 1}/${pages} 页 (${processed}/${total})`,
        );

        // 如果批量大小很小（比如5），我们可以添加延迟来模拟长时间运行的任务
        // 这对于调试进度条很有用
        if (batchSize <= 5) {
          await new Promise((resolve) => setTimeout(resolve, 500)); // 500ms延迟
        }
      } catch (error) {
        console.error(`❌ 处理第 ${page + 1} 页时出错:`, error);
      }
    }

    console.log(`✅ 分页批量计算完成:`);
    console.log(`   总设备: ${total}`);
    console.log(
      `   在线: ${online} (${total > 0 ? Math.round((online / total) * 100) : 0}%)`,
    );
    console.log(
      `   离线: ${offline} (${total > 0 ? Math.round((offline / total) * 100) : 0}%)`,
    );
    console.log(`   批次大小: ${batchSize}`);
    console.log(`   总页数: ${pages}`);

    return { total, processed, online, offline, pages, batchSize };
  }

  /**
   * 计算在线CPE数量（基于配置的超时时间）
   */
  static async calculateOnlineCount(): Promise<number> {
    const timeoutMs = config.cpeManagement.onlineTimeout;
    const cutoffTime = new Date(Date.now() - timeoutMs);

    return await CPEModel.countDocuments({
      lastSeen: { $gte: cutoffTime },
    });
  }

  /**
   * 获取详细的CPE统计信息
   */
  static async getDetailedStats(): Promise<{
    total: number;
    online: number;
    offline: number;
    onlinePercentage: number;
    byManufacturer: Array<{
      manufacturer: string;
      model: string;
      count: number;
    }>;
  }> {
    const timeoutMs = config.cpeManagement.onlineTimeout;
    const cutoffTime = new Date(Date.now() - timeoutMs);

    const total = await CPEModel.countDocuments({});
    const online = await CPEModel.countDocuments({
      lastSeen: { $gte: cutoffTime },
    });

    // 按厂商/型号分组统计
    const byManufacturer = await CPEModel.aggregate([
      {
        $match: {
          lastSeen: { $gte: cutoffTime },
        },
      },
      {
        $group: {
          _id: {
            manufacturer: { $ifNull: ['$manufacturer', 'unknown'] },
            model: { $ifNull: ['$model', 'unknown'] },
          },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          manufacturer: '$_id.manufacturer',
          model: '$_id.model',
          count: 1,
          _id: 0,
        },
      },
      { $sort: { count: -1 } },
    ]);

    return {
      total,
      online,
      offline: total - online,
      onlinePercentage: total > 0 ? Math.round((online / total) * 100) : 0,
      byManufacturer,
    };
  }

  /**
   * 获取状态统计
   */
  static async getStatusStats(): Promise<{
    total: number;
    online: number;
    offline: number;
    lastRefresh?: Date;
  }> {
    const total = await CPEModel.countDocuments({});
    const online = await CPEModel.countDocuments({ onlineStatus: 'online' });
    const offline = await CPEModel.countDocuments({ onlineStatus: 'offline' });

    // 获取最新刷新的时间
    const latest = await CPEModel.findOne({
      onlineStatusUpdatedAt: { $ne: null },
    })
      .sort({ onlineStatusUpdatedAt: -1 })
      .select('onlineStatusUpdatedAt');

    return {
      total,
      online,
      offline,
      lastRefresh: latest?.onlineStatusUpdatedAt,
    };
  }
}
