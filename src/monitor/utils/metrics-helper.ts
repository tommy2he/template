// src/monitor/utils/metrics-helper.ts
import { register } from '../prometheus/client';

export class MetricsHelper {
  /**
   * 获取所有指标（原始格式）
   */
  static async getAllMetrics(): Promise<string> {
    return await register.metrics();
  }

  /**
   * 获取指标JSON格式
   */
  static async getMetricsAsJSON(): Promise<any[]> {
    return await register.getMetricsAsJSON();
  }

  /**
   * 获取特定指标
   */
  static async getMetricByName(name: string): Promise<any> {
    const metrics = await register.getMetricsAsJSON();
    return metrics.find((m) => m.name === name);
  }

  /**
   * 获取HTTP相关指标
   */
  static async getHTTPMetrics() {
    const metrics = await register.getMetricsAsJSON();

    return {
      requests: metrics.find((m) => m.name === 'http_requests_total'),
      duration: metrics.find((m) => m.name === 'http_request_duration_seconds'),
      size: metrics.find((m) => m.name === 'http_response_size_bytes'),
      // 请求率（基于时间窗口计算）
      requestRate: await this.calculateRequestRate(),
    };
  }

  /**
   * 计算请求率（请求/秒）
   */
  static async calculateRequestRate(
    windowSeconds: number = 60,
  ): Promise<number> {
    const requestsMetric = await this.getMetricByName('http_requests_total');
    if (!requestsMetric || !requestsMetric.values) return 0;

    // 这里需要时间序列数据来计算率
    // 简化实现：返回最近的值
    const totalRequests = requestsMetric.values.reduce(
      (sum: number, val: any) => sum + val.value,
      0,
    );
    return totalRequests / windowSeconds;
  }

  /**
   * 获取指标摘要（用于调试）
   */
  static async getSummary(): Promise<Record<string, any>> {
    const metrics = await register.getMetricsAsJSON();

    const summary: Record<string, any> = {
      totalMetrics: metrics.length,
      timestamp: new Date().toISOString(),
      metrics: {},
    };

    // 按类型分组
    metrics.forEach((metric) => {
      if (!summary.metrics[metric.type]) {
        summary.metrics[metric.type] = [];
      }

      summary.metrics[metric.type].push({
        name: metric.name,
        help: metric.help,
        valueCount: metric.values ? metric.values.length : 0,
        // 样本数据（前3个值）
        samples: metric.values ? metric.values.slice(0, 3) : [],
      });
    });

    return summary;
  }
}
