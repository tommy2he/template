// src/monitor/index.ts - 最终简单版本
/* eslint-disable no-console */
export { client, register } from './prometheus/client';
export { httpMetrics, cpeMetrics, dbMetrics } from './prometheus/metrics';
export { MetricsExporter } from './exporter/metrics-exporter';

// 简单的初始化函数
export function initMonitoring() {
  console.log('✅ Prometheus monitoring initialized');
  // 监控已通过import自动初始化
}
