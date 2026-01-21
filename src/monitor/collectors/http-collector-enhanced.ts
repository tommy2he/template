// src/monitor/collectors/http-collector-enhanced.ts
/* eslint-disable no-console */
import { Context, Next } from 'koa';
import { httpMetrics } from '../prometheus/metrics';
import { register } from '../prometheus/client';

export interface HTTPCollectorConfig {
  enabled: boolean;
  recordSize: boolean;
  normalizeRoutes: boolean;
  logRequests: boolean;
  excludedRoutes: string[];
  includeQueryParams: boolean;
}

export const defaultHTTPCollectorConfig: HTTPCollectorConfig = {
  enabled: true,
  recordSize: true,
  normalizeRoutes: true,
  logRequests: process.env.NODE_ENV === 'development',
  excludedRoutes: [
    '/metrics', // Prometheus metrics端点
    '/api/health', // 健康检查
    '/api/performance', // 性能端点
    '/favicon.ico', // 图标
    '/api-docs', // Swagger文档
  ],
  includeQueryParams: false,
};

export class EnhancedHTTPCollector {
  private config: HTTPCollectorConfig;

  constructor(config: Partial<HTTPCollectorConfig> = {}) {
    this.config = { ...defaultHTTPCollectorConfig, ...config };
  }

  /**
   * 创建Koa中间件
   */
  createMiddleware() {
    return async (ctx: Context, next: Next): Promise<void> => {
      // 检查是否排除此路由
      if (!this.config.enabled || this.shouldExcludeRoute(ctx.path)) {
        return await next();
      }

      const start = Date.now();
      let hasError = false;

      try {
        await next();
      } catch (error) {
        hasError = true;
        throw error;
      } finally {
        // 无论成功还是失败，都记录指标
        this.recordRequest(ctx, start, hasError);
      }
    };
  }

  /**
   * 检查是否应该排除此路由
   */
  private shouldExcludeRoute(path: string): boolean {
    return this.config.excludedRoutes.some(
      (route) => path === route || path.startsWith(route + '/'),
    );
  }

  /**
   * 记录HTTP请求指标
   */
  private recordRequest(
    ctx: Context,
    startTime: number,
    hasError: boolean,
  ): void {
    const duration = Date.now() - startTime;
    const durationSeconds = duration / 1000;

    // 获取路由路径
    const route = this.config.normalizeRoutes
      ? this.normalizeRoute(ctx.path)
      : ctx.path;

    // 如果需要包含查询参数
    const fullPath =
      this.config.includeQueryParams && ctx.querystring
        ? `${route}?${ctx.querystring}`
        : route;

    const method = ctx.method.toUpperCase();
    const status = ctx.status || (hasError ? 500 : 200);
    const statusGroup = this.getStatusGroup(status);

    try {
      // 记录请求计数
      httpMetrics.requests.inc({
        method,
        route: fullPath,
        status: statusGroup,
      });

      // 记录请求持续时间
      httpMetrics.duration.observe(
        {
          method,
          route: fullPath,
        },
        durationSeconds,
      );

      // 记录响应大小
      if (this.config.recordSize) {
        const responseSize = this.getResponseSize(ctx);
        if (responseSize > 0) {
          httpMetrics.size.observe(
            {
              method,
              route: fullPath,
            },
            responseSize,
          );
        }
      }

      // 记录日志
      if (this.config.logRequests) {
        console.log(
          `📊 [HTTP监控] ${method} ${fullPath} - ${status} (${duration}ms)`,
        );
      }
    } catch (error) {
      // 避免指标收集失败影响主流程
      console.error('Failed to record HTTP metrics:', error);
    }
  }

  /**
   * 规范化路由路径
   * 将动态路径参数转换为模式（如 /users/:id）
   */
  private normalizeRoute(path: string): string {
    // 移除查询参数
    const cleanPath = path.split('?')[0];

    // 如果是API路径，进行简化
    if (cleanPath.startsWith('/api/')) {
      let normalized = cleanPath;

      // 处理数字ID
      normalized = normalized.replace(/\/\d+(?=\/|$)/g, '/:id');

      // 处理UUID
      normalized = normalized.replace(
        /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi,
        '/:uuid',
      );

      // 处理MongoDB ObjectId
      normalized = normalized.replace(/\/[0-9a-f]{24}(?=\/|$)/gi, '/:objectId');

      return normalized;
    }

    return cleanPath;
  }

  /**
   * 获取状态码分组
   */
  private getStatusGroup(status: number): string {
    if (status >= 100 && status < 200) return '1xx';
    if (status >= 200 && status < 300) return '2xx';
    if (status >= 300 && status < 400) return '3xx';
    if (status >= 400 && status < 500) return '4xx';
    if (status >= 500) return '5xx';
    return 'unknown';
  }

  /**
   * 获取响应大小
   */
  private getResponseSize(ctx: Context): number {
    try {
      // 方法1: 从Content-Length头获取
      const contentLength = ctx.response.get('Content-Length');
      if (contentLength) {
        const size = parseInt(contentLength, 10);
        if (!isNaN(size)) return size;
      }

      // 方法2: 从响应体计算
      if (ctx.body) {
        if (typeof ctx.body === 'string') {
          return Buffer.byteLength(ctx.body, 'utf8');
        }

        if (Buffer.isBuffer(ctx.body)) {
          return ctx.body.length;
        }

        if (typeof ctx.body === 'object') {
          // 对于对象，转换为JSON字符串
          try {
            const jsonString = JSON.stringify(ctx.body);
            return Buffer.byteLength(jsonString, 'utf8');
          } catch {
            // 如果无法序列化，返回0
          }
        }

        // 对于其他类型（如stream），返回0
        return 0;
      }

      return 0;
    } catch (error) {
      console.error('监控系统异常 - HTTP请求记录失败:', error);
      // 计算大小失败时返回0
      return 0;
    }
  }

  /**
   * 手动记录HTTP请求
   * 用于不在中间件链中的请求（如WebSocket升级请求等）
   */
  recordManualRequest(
    method: string,
    route: string,
    status: number,
    durationMs: number,
    sizeBytes?: number,
  ): void {
    if (!this.config.enabled) return;

    const durationSeconds = durationMs / 1000;
    const normalizedRoute = this.config.normalizeRoutes
      ? this.normalizeRoute(route)
      : route;
    const statusGroup = this.getStatusGroup(status);

    try {
      httpMetrics.requests.inc({
        method: method.toUpperCase(),
        route: normalizedRoute,
        status: statusGroup,
      });

      httpMetrics.duration.observe(
        {
          method: method.toUpperCase(),
          route: normalizedRoute,
        },
        durationSeconds,
      );

      if (sizeBytes !== undefined && sizeBytes > 0) {
        httpMetrics.size.observe(
          {
            method: method.toUpperCase(),
            route: normalizedRoute,
          },
          sizeBytes,
        );
      }
    } catch (error) {
      console.error('Failed to record manual HTTP metrics:', error);
    }
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<HTTPCollectorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * 获取当前配置
   */
  getConfig(): HTTPCollectorConfig {
    return { ...this.config };
  }

  //   /**
  //    * 获取指标摘要（用于调试）
  //    */
  //   static getSummary() {
  //     return {
  //       requests: (httpMetrics.requests as any).hashMap,
  //       duration: (httpMetrics.duration as any).hashMap,
  //       size: (httpMetrics.size as any).hashMap,
  //     };
  //   }
  /**
   * 获取指标摘要（改进版）
   */
  async getMetricsSummary() {
    try {
      const metrics = await register.getMetricsAsJSON();

      // 查找特定指标
      const findMetric = (name: string) => {
        const metric = metrics.find((m) => m.name === name);
        if (!metric) return null;

        return {
          name: metric.name,
          type: metric.type,
          help: metric.help,
          samples: metric.values || [],
          totalSamples: metric.values ? metric.values.length : 0,
        };
      };

      return {
        requests: findMetric('http_requests_total'),
        duration: findMetric('http_request_duration_seconds'),
        size: findMetric('http_response_size_bytes'),
        allMetrics: metrics.map((m) => ({ name: m.name, type: m.type })),
      };
    } catch (error) {
      console.error('Failed to get metrics summary:', error);
      return {
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

// 创建默认实例
export const defaultHTTPCollector = new EnhancedHTTPCollector();

// 默认导出中间件创建函数
/**
 * 创建一个HTTP监控中间件工厂函数
 * 注意：此函数返回的是真正的Koa中间件函数
 */
export const createHTTPMonitoringMiddleware = (
  config?: Partial<HTTPCollectorConfig>,
) => {
  const collector = new EnhancedHTTPCollector(config);
  return collector.createMiddleware();
};

// 默认导出（兼容基本版）
export default createHTTPMonitoringMiddleware;
