import { Context, Next } from 'koa';
import os from 'os';

// 性能监控数据结构
interface PerformanceMetrics {
  requestCount: number;
  errorCount: number;
  totalResponseTime: number;
  responseTimes: number[];
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  uptime: number;
  timestamp: Date;
}

// 全局性能监控器
export class PerformanceMonitor {
  // 添加 export 关键字
  private static instance: PerformanceMonitor;
  private metrics: Map<string, PerformanceMetrics>;
  private startTime: Date;

  private constructor() {
    this.metrics = new Map();
    this.startTime = new Date();
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // 记录请求
  recordRequest(
    endpoint: string,
    responseTime: number,
    isError: boolean = false,
  ): void {
    if (!this.metrics.has(endpoint)) {
      this.metrics.set(endpoint, {
        requestCount: 0,
        errorCount: 0,
        totalResponseTime: 0,
        responseTimes: [],
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
        uptime: process.uptime(),
        timestamp: new Date(),
      });
    }

    const metric = this.metrics.get(endpoint)!;
    metric.requestCount++;
    metric.totalResponseTime += responseTime;
    metric.responseTimes.push(responseTime);

    if (isError) {
      metric.errorCount++;
    }

    // 更新系统指标
    metric.memoryUsage = process.memoryUsage();
    metric.cpuUsage = process.cpuUsage();
    metric.uptime = process.uptime();
    metric.timestamp = new Date();

    // 限制响应时间数组大小
    if (metric.responseTimes.length > 1000) {
      metric.responseTimes = metric.responseTimes.slice(-1000);
    }
  }

  // 获取性能指标
  getMetrics(endpoint?: string): any {
    if (endpoint) {
      return this.metrics.get(endpoint) || null;
    }

    const allMetrics: any = {};
    let totalRequests = 0;
    let totalErrors = 0;
    let totalResponseTime = 0;
    let allResponseTimes: number[] = [];

    this.metrics.forEach((metric, key) => {
      allMetrics[key] = {
        ...metric,
        avgResponseTime:
          metric.requestCount > 0
            ? metric.totalResponseTime / metric.requestCount
            : 0,
        errorRate:
          metric.requestCount > 0
            ? (metric.errorCount / metric.requestCount) * 100
            : 0,
        p95: this.calculatePercentile(metric.responseTimes, 95),
        p99: this.calculatePercentile(metric.responseTimes, 99),
      };

      totalRequests += metric.requestCount;
      totalErrors += metric.errorCount;
      totalResponseTime += metric.totalResponseTime;
      allResponseTimes = allResponseTimes.concat(metric.responseTimes);
    });

    return {
      uptime: process.uptime(),
      startTime: this.startTime.toISOString(),
      system: {
        memory: process.memoryUsage(),
        cpu: os.cpus(),
        loadAvg: os.loadavg(),
        platform: os.platform(),
        arch: os.arch(),
      },
      summary: {
        totalRequests,
        totalErrors,
        avgResponseTime:
          totalRequests > 0 ? totalResponseTime / totalRequests : 0,
        errorRate: totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0,
        endpoints: this.metrics.size,
      },
      endpoints: allMetrics,
      percentiles: {
        p50: this.calculatePercentile(allResponseTimes, 50),
        p95: this.calculatePercentile(allResponseTimes, 95),
        p99: this.calculatePercentile(allResponseTimes, 99),
        p99_9: this.calculatePercentile(allResponseTimes, 99.9),
      },
    };
  }

  // 计算百分位数
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  // 重置指标
  reset(): void {
    this.metrics.clear();
    this.startTime = new Date();
  }
}

// 性能监控中间件
export function performanceMonitor() {
  const monitor = PerformanceMonitor.getInstance();

  return async (ctx: Context, next: Next) => {
    const start = process.hrtime();

    try {
      await next();

      const [seconds, nanoseconds] = process.hrtime(start);
      const responseTime = seconds * 1000 + nanoseconds / 1000000;

      monitor.recordRequest(ctx.path, responseTime, ctx.status >= 400);

      // 添加性能头信息
      ctx.set('X-Response-Time', `${responseTime.toFixed(2)}ms`);
      ctx.set('X-Performance-Monitored', 'true');
    } catch (error) {
      const [seconds, nanoseconds] = process.hrtime(start);
      const responseTime = seconds * 1000 + nanoseconds / 1000000;

      monitor.recordRequest(ctx.path, responseTime, true);
      throw error;
    }
  };
}

// 获取性能指标的路由处理器
export function getPerformanceMetrics() {
  const monitor = PerformanceMonitor.getInstance();

  return (ctx: Context) => {
    const metrics = monitor.getMetrics();

    ctx.body = {
      success: true,
      timestamp: new Date().toISOString(),
      data: metrics,
    };
  };
}

// 重置性能指标
export function resetPerformanceMetrics() {
  return (ctx: Context) => {
    const monitor = PerformanceMonitor.getInstance();
    monitor.reset();

    ctx.body = {
      success: true,
      message: 'Performance metrics have been reset',
      timestamp: new Date().toISOString(),
    };
  };
}
