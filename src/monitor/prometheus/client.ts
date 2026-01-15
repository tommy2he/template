// src/monitor/prometheus/client.ts
import client from 'prom-client';

// 创建全局注册表
const register = new client.Registry();

// 设置默认标签
register.setDefaultLabels({
  app: 'koa_template_app',
  version: '2.2.0',
  environment: process.env.NODE_ENV || 'development',
});

// 启用默认指标收集
client.collectDefaultMetrics({
  register,
  prefix: 'koa_app_',
  gcDurationBuckets: [0.1, 0.2, 0.3], // GC持续时间桶
});

export { client, register };
