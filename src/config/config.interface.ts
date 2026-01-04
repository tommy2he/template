// src/config/config.interface.ts
export interface IConfig {
  // 应用配置
  env: string;
  port: number;
  appName: string;
  appUrl: string;

  // WebSocket配置
  wsPort: number;
  wsUrl: string;

  // 日志配置
  logLevel: string;
  logFormat: string;

  // API 配置
  apiPrefix: string;
  apiVersion: string;
  apiTimeout: number;

  // CORS 配置
  corsOrigin: string;
  corsCredentials: boolean;

  // 数据库配置
  mongodb: {
    uri: string;
    adminUri: string;
    options: {
      maxPoolSize: number;
      minPoolSize: number;
      socketTimeoutMS: number;
      connectTimeoutMS: number;
      retryWrites: boolean;
      retryReads: boolean;
      serverSelectionTimeoutMS: number;
    };
  };

  // 安全配置
  jwtSecret: string;
  jwtExpiresIn: string;

  // 开发配置
  enableSwagger: boolean;
  debug: boolean;

  // 其他配置
  uploadMaxSize: number;
  uploadAllowedTypes: string[];

  // 1.3版本新增配置
  rateLimit: {
    enabled: boolean;
    maxRequests: number;
    windowMs: number;
  };
  compression: {
    enabled: boolean;
    threshold: number;
  };
  security: {
    enabled: boolean;
    cspEnabled: boolean;
    hstsEnabled: boolean;
  };
  swagger: {
    enabled: boolean;
    title: string;
    description: string;
    version: string;
  };

  // 1.4版本新增性能监控配置
  performance: {
    enabled: boolean;
    sampleRate: number;
    retentionDays: number;
    endpoints: string[];
  };

  // ========== 2.0版本新增CPE管理配置 ==========
  cpeManagement: {
    // 在线状态计算配置
    onlineTimeout: number; // CPE在线超时时间（毫秒）
    statusRefreshMode: string; // 状态刷新模式：manual/timed
    bootThreshold: number; // 启动阈值（毫秒）

    // 批量处理配置
    refreshBatchSize: number; // 状态刷新批量大小
  };
}
