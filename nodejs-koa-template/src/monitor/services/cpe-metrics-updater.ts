// 创建新文件：/src/monitor/services/cpe-metrics-updater.ts
/* eslint-disable no-console */
import { cpeMetrics } from '../prometheus/metrics';
import { CPEModel } from '../../db/schemas/cpe.schema';
import config from '../../config';

export class CPEMetricsUpdater {
  private updateInterval: NodeJS.Timeout | null = null;

  /**
   * 更新所有CPE相关指标
   */
  async updateMetrics(): Promise<void> {
    try {
      // 1. 更新在线CPE总数（直接从数据库读取onlineStatus字段）
      await this.updateOnlineCPECount();

      // 2. 更新按厂商/型号的分布
      await this.updateOnlineByManufacturer();

      // 3. 更新连接数指标
      await this.updateConnectionStats();

      // 4. 更新心跳统计
      await this.updateHeartbeatStats();

      console.log('✅ CPE指标已更新');
    } catch (error) {
      console.error('❌ 更新CPE指标失败:', error);
    }
  }

  /**
   * 更新在线CPE总数 - 直接从数据库读取onlineStatus字段
   */
  private async updateOnlineCPECount(): Promise<void> {
    try {
      // 直接查询onlineStatus为'online'的文档
      const onlineCount = await CPEModel.countDocuments({
        onlineStatus: 'online',
      });

      const totalCount = await CPEModel.countDocuments({});

      // 设置指标值
      cpeMetrics.onlineTotal.set({}, onlineCount);

      console.log(
        `📊 CPE统计: 总设备=${totalCount}, 在线=${onlineCount}, 离线=${totalCount - onlineCount}`,
      );

      // 如果onlineStatus字段缺失（比如老数据），可以给出警告
      const withoutStatus = await CPEModel.countDocuments({
        onlineStatus: { $exists: false },
      });

      if (withoutStatus > 0) {
        console.warn(
          `⚠️  有 ${withoutStatus} 个CPE没有onlineStatus字段，可能需要执行状态刷新`,
        );
      }
    } catch (error) {
      console.error('更新在线CPE数量失败:', error);
    }
  }

  /**
   * 更新按厂商和型号的CPE分布
   */
  private async updateOnlineByManufacturer(): Promise<void> {
    try {
      // 按厂商和型号分组统计在线CPE
      const stats = await CPEModel.aggregate([
        {
          $match: {
            onlineStatus: 'online',
            manufacturer: { $exists: true, $ne: null },
            model: { $exists: true, $ne: null },
          },
        },
        {
          $group: {
            _id: {
              manufacturer: '$manufacturer',
              model: '$model',
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]);

      // 为每个厂商/型号组合设置指标
      stats.forEach((stat) => {
        cpeMetrics.onlineByModel.set(
          {
            manufacturer: stat._id.manufacturer,
            model: stat._id.model,
          },
          stat.count,
        );
      });

      // 统计未知厂商/型号的在线CPE
      const unknownCount = await CPEModel.countDocuments({
        onlineStatus: 'online',
        $or: [
          { manufacturer: { $exists: false } },
          { manufacturer: null },
          { model: { $exists: false } },
          { model: null },
        ],
      });

      if (unknownCount > 0) {
        cpeMetrics.onlineByModel.set(
          { manufacturer: 'unknown', model: 'unknown' },
          unknownCount,
        );
      }

      console.log(
        `📊 CPE厂商/型号分布: 在线设备共有 ${stats.length} 种组合，未知厂商/型号: ${unknownCount}`,
      );

      // 显示前5个主要厂商
      if (stats.length > 0) {
        console.log('📋 主要厂商分布 (前5):');
        stats.slice(0, 5).forEach((stat, index) => {
          console.log(
            `   ${index + 1}. ${stat._id.manufacturer} ${stat._id.model}: ${stat.count}`,
          );
        });
      }
    } catch (error) {
      console.error('更新CPE分布统计失败:', error);
    }
  }

  /**
   * 更新连接统计
   */
  private async updateConnectionStats(): Promise<void> {
    try {
      const connectionStats = await CPEModel.aggregate([
        {
          $group: {
            _id: '$connectionStatus',
            count: { $sum: 1 },
          },
        },
      ]);

      // 将连接状态转换为活跃连接数（仅统计connected和registered）
      const activeConnections = connectionStats
        .filter((stat) => ['connected', 'registered'].includes(stat._id))
        .reduce((sum, stat) => sum + stat.count, 0);

      cpeMetrics.connections.set(activeConnections);

      // 打印详细统计
      console.log('🔗 连接状态分布:');
      connectionStats.forEach((stat) => {
        console.log(`   ${stat._id || 'unknown'}: ${stat.count}`);
      });
    } catch (error) {
      console.error('更新连接统计失败:', error);
    }
  }

  /**
   * 更新心跳统计
   */
  private async updateHeartbeatStats(): Promise<void> {
    try {
      // 获取总心跳数
      const heartbeatStats = await CPEModel.aggregate([
        {
          $group: {
            _id: null,
            totalHeartbeats: { $sum: '$heartbeatCount' },
            avgHeartbeat: { $avg: '$heartbeatCount' },
          },
        },
      ]);

      const totalHeartbeats = heartbeatStats[0]?.totalHeartbeats || 0;
      const avgHeartbeat = heartbeatStats[0]?.avgHeartbeat || 0;

      cpeMetrics.heartbeats.set(totalHeartbeats);

      console.log(
        `💓 心跳统计: 总心跳数=${totalHeartbeats}, 平均每设备=${avgHeartbeat.toFixed(2)}`,
      );
    } catch (error) {
      console.error('更新心跳统计失败:', error);
    }
  }

  /**
   * 获取详细的CPE指标统计（用于API端点）
   */
  async getDetailedStats() {
    const total = await CPEModel.countDocuments({});
    const online = await CPEModel.countDocuments({ onlineStatus: 'online' });
    const offline = await CPEModel.countDocuments({ onlineStatus: 'offline' });
    const withoutStatus = await CPEModel.countDocuments({
      onlineStatus: { $exists: false },
    });

    // 连接状态统计
    const connectionStats = await CPEModel.aggregate([
      {
        $group: {
          _id: '$connectionStatus',
          count: { $sum: 1 },
        },
      },
    ]);

    // 厂商分布
    const manufacturerStats = await CPEModel.aggregate([
      {
        $match: {
          onlineStatus: 'online',
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
      { $sort: { count: -1 } },
    ]);

    return {
      total,
      online,
      offline,
      withoutStatus,
      onlinePercentage: total > 0 ? Math.round((online / total) * 100) : 0,
      connectionStats: connectionStats.map((stat) => ({
        status: stat._id,
        count: stat.count,
      })),
      manufacturerStats: manufacturerStats.map((stat) => ({
        manufacturer: stat._id.manufacturer,
        model: stat._id.model,
        count: stat.count,
      })),
    };
  }

  /**
   * 启动定时更新
   */
  start(intervalMs: number = 60000): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    // 立即执行一次
    this.updateMetrics();

    // 启动定时更新
    this.updateInterval = setInterval(() => {
      this.updateMetrics();
    }, intervalMs);

    console.log(`⏰ CPE指标定时更新已启动，间隔: ${intervalMs}ms`);
  }

  /**
   * 停止定时更新
   */
  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      console.log('⏹️  CPE指标定时更新已停止');
    }
  }

  /**
   * 获取Prometheus格式的原始指标 - 基于数据库现有字段（非实时计算）
   */
  async getRawMetrics(): Promise<string> {
    try {
      const timestamp = Date.now() / 1000; // Prometheus使用秒级时间戳

      // 1. 获取基于onlineStatus字段的在线CPE数量
      const onlineStats = await this.getOnlineStatsFromDatabase();

      // 2. 获取连接统计
      const connectionStats = await this.getConnectionStatsFromDatabase();

      // 3. 获取心跳统计
      const heartbeatStats = await this.getHeartbeatStatsFromDatabase();

      // 4. 获取厂商分布统计（可选）
      const manufacturerStats = await this.getManufacturerStatsFromDatabase();

      return this.formatPrometheusMetrics({
        timestamp,
        onlineStats,
        connectionStats,
        heartbeatStats,
        manufacturerStats,
      });
    } catch (error) {
      console.error('获取原始指标失败:', error);
      return `# ERROR: Failed to generate CPE metrics: ${(error as Error).message}\n`;
    }
  }

  /**
   * 从数据库获取在线统计（基于onlineStatus字段）
   */
  private async getOnlineStatsFromDatabase(): Promise<{
    online: number;
    offline: number;
    total: number;
    withoutStatus: number;
  }> {
    const total = await CPEModel.countDocuments({});
    const online = await CPEModel.countDocuments({ onlineStatus: 'online' });
    const offline = await CPEModel.countDocuments({ onlineStatus: 'offline' });
    const withoutStatus = await CPEModel.countDocuments({
      onlineStatus: { $exists: false },
    });

    return { online, offline, total, withoutStatus };
  }

  /**
   * 从数据库获取连接统计
   */
  private async getConnectionStatsFromDatabase(): Promise<{
    activeConnections: number;
    byStatus: Array<{ status: string; count: number }>;
  }> {
    const connectionStats = await CPEModel.aggregate([
      {
        $group: {
          _id: '$connectionStatus',
          count: { $sum: 1 },
        },
      },
    ]);

    const activeConnections = connectionStats
      .filter((stat) => ['connected', 'registered'].includes(stat._id))
      .reduce((sum, stat) => sum + stat.count, 0);

    return {
      activeConnections,
      byStatus: connectionStats.map((stat) => ({
        status: stat._id || 'unknown',
        count: stat.count,
      })),
    };
  }

  /**
   * 从数据库获取心跳统计
   */
  private async getHeartbeatStatsFromDatabase(): Promise<{
    totalHeartbeats: number;
    avgHeartbeatsPerDevice: number;
    maxHeartbeats: number;
  }> {
    const heartbeatStats = await CPEModel.aggregate([
      {
        $group: {
          _id: null,
          totalHeartbeats: { $sum: '$heartbeatCount' },
          avgHeartbeats: { $avg: '$heartbeatCount' },
          maxHeartbeats: { $max: '$heartbeatCount' },
          deviceCount: { $sum: 1 },
        },
      },
    ]);

    const stats = heartbeatStats[0] || {};
    return {
      totalHeartbeats: stats.totalHeartbeats || 0,
      avgHeartbeatsPerDevice: stats.avgHeartbeats || 0,
      maxHeartbeats: stats.maxHeartbeats || 0,
    };
  }

  /**
   * 从数据库获取厂商分布统计
   */
  private async getManufacturerStatsFromDatabase(): Promise<
    Array<{ manufacturer: string; model: string; count: number }>
  > {
    const manufacturerStats = await CPEModel.aggregate([
      {
        $match: {
          onlineStatus: 'online',
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
      { $sort: { count: -1 } },
      { $limit: 20 }, // 限制数量，避免指标过多
    ]);

    return manufacturerStats.map((stat) => ({
      manufacturer: stat._id.manufacturer,
      model: stat._id.model,
      count: stat.count,
    }));
  }

  /**
   * 格式化Prometheus指标
   */
  private formatPrometheusMetrics(data: {
    timestamp: number;
    onlineStats: any;
    connectionStats: any;
    heartbeatStats: any;
    manufacturerStats: any;
  }): string {
    const {
      timestamp,
      onlineStats,
      connectionStats,
      heartbeatStats,
      manufacturerStats,
    } = data;

    let output = `# HELP cpe_online_total Number of online CPE devices (based on onlineStatus field)
# TYPE cpe_online_total gauge
cpe_online_total ${onlineStats.online}

# HELP cpe_offline_total Number of offline CPE devices (based on onlineStatus field)
# TYPE cpe_offline_total gauge
cpe_offline_total ${onlineStats.offline}

# HELP cpe_total_all Total number of CPE devices
# TYPE cpe_total_all gauge
cpe_total_all ${onlineStats.total}

# HELP cpe_without_status Number of CPE devices without onlineStatus field
# TYPE cpe_without_status gauge
cpe_without_status ${onlineStats.withoutStatus}

# HELP cpe_connections_active Active WebSocket connections (connected or registered)
# TYPE cpe_connections_active gauge
cpe_connections_active ${connectionStats.activeConnections}

# HELP cpe_heartbeats_total Total heartbeat messages received from all CPEs
# TYPE cpe_heartbeats_total gauge
cpe_heartbeats_total ${heartbeatStats.totalHeartbeats}

# HELP cpe_avg_heartbeats_per_device Average heartbeat count per CPE device
# TYPE cpe_avg_heartbeats_per_device gauge
cpe_avg_heartbeats_per_device ${heartbeatStats.avgHeartbeatsPerDevice.toFixed(2)}

# HELP cpe_max_heartbeats Maximum heartbeat count from a single CPE device
# TYPE cpe_max_heartbeats gauge
cpe_max_heartbeats ${heartbeatStats.maxHeartbeats}

# HELP cpe_metrics_last_update_seconds Last update timestamp of CPE metrics
# TYPE cpe_metrics_last_update_seconds gauge
cpe_metrics_last_update_seconds ${timestamp}\n`;

    // 添加厂商/型号分布指标（带标签）
    if (manufacturerStats.length > 0) {
      output += `\n# HELP cpe_by_manufacturer_model Number of online CPEs by manufacturer and model
# TYPE cpe_by_manufacturer_model gauge\n`;

      manufacturerStats.forEach((stat: any) => {
        output += `cpe_by_manufacturer_model{manufacturer="${stat.manufacturer}",model="${stat.model}"} ${stat.count}\n`;
      });
    }

    // 添加连接状态分布指标
    if (connectionStats.byStatus.length > 0) {
      output += `\n# HELP cpe_connections_by_status Number of CPEs by connection status
# TYPE cpe_connections_by_status gauge\n`;

      connectionStats.byStatus.forEach((stat: any) => {
        output += `cpe_connections_by_status{status="${stat.status}"} ${stat.count}\n`;
      });
    }

    return output;
  }

  // ============================================
  // 实时计算函数（用于测试/对比）
  // ============================================

  /**
   * 实时计算在线CPE数量（基于lastSeen时间，用于测试对比）
   */
  private async calculateRealtimeOnlineCPECount(): Promise<number> {
    try {
      // 使用StatusCalculator中的超时配置
      const timeoutMs = config.cpeManagement.onlineTimeout;
      const cutoffTime = new Date(Date.now() - timeoutMs);

      return await CPEModel.countDocuments({
        lastSeen: { $gte: cutoffTime },
      });
    } catch (error) {
      console.error('实时计算在线CPE数量失败:', error);
      return 0;
    }
  }

  /**
   * 实时计算CPE统计（基于lastSeen时间，用于测试对比）
   */
  async getRealtimeStats(): Promise<{
    realtimeOnline: number;
    databaseOnline: number;
    difference: number;
    percentageDifference: string;
  }> {
    try {
      // 实时计算
      const realtimeOnline = await this.calculateRealtimeOnlineCPECount();

      // 数据库onlineStatus字段统计
      const databaseOnline = await CPEModel.countDocuments({
        onlineStatus: 'online',
      });

      const difference = realtimeOnline - databaseOnline;
      const percentageDifference =
        databaseOnline > 0
          ? `${((difference / databaseOnline) * 100).toFixed(2)}%`
          : 'N/A';

      return {
        realtimeOnline,
        databaseOnline,
        difference,
        percentageDifference,
      };
    } catch (error) {
      console.error('获取实时统计失败:', error);
      throw error;
    }
  }

  /**
   * 获取实时计算指标（用于测试）
   */
  async getRealtimeMetrics(): Promise<string> {
    try {
      const timestamp = Date.now() / 1000;
      const timeoutMs = config.cpeManagement.onlineTimeout;
      const cutoffTime = new Date(Date.now() - timeoutMs);

      // 实时计算在线数量
      const realtimeOnline = await CPEModel.countDocuments({
        lastSeen: { $gte: cutoffTime },
      });

      // 数据库onlineStatus在线数量
      const databaseOnline = await CPEModel.countDocuments({
        onlineStatus: 'online',
      });

      const total = await CPEModel.countDocuments({});

      return `# HELP cpe_online_realtime Realtime online CPE count (based on lastSeen)
# TYPE cpe_online_realtime gauge
cpe_online_realtime ${realtimeOnline}

# HELP cpe_online_database Database online CPE count (based on onlineStatus)
# TYPE cpe_online_database gauge
cpe_online_database ${databaseOnline}

# HELP cpe_online_difference Difference between realtime and database counts
# TYPE cpe_online_difference gauge
cpe_online_difference ${realtimeOnline - databaseOnline}

# HELP cpe_total_all Total number of CPE devices
# TYPE cpe_total_all gauge
cpe_total_all ${total}

# HELP cpe_realtime_timeout_seconds Timeout used for realtime calculation
# TYPE cpe_realtime_timeout_seconds gauge
cpe_realtime_timeout_seconds ${timeoutMs / 1000}

# HELP cpe_realtime_last_update_seconds Last update timestamp of realtime metrics
# TYPE cpe_realtime_last_update_seconds gauge
cpe_realtime_last_update_seconds ${timestamp}`;
    } catch (error) {
      console.error('获取实时指标失败:', error);
      return `# ERROR: Failed to generate realtime metrics: ${(error as Error).message}\n`;
    }
  }
}

// 导出单例实例
export const cpeMetricsUpdater = new CPEMetricsUpdater();
