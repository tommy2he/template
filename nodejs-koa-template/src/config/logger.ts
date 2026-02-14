/**
 * 配置模块专用的日志工具
 * 在配置加载阶段，常规日志系统可能还未初始化
 */

export enum ConfigLogLevel {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface ConfigLogOptions {
  level: ConfigLogLevel;
  message: string;
  context?: Record<string, any>;
}

class ConfigLogger {
  private static instance: ConfigLogger;
  private enabled: boolean = true;

  private constructor() {}

  static getInstance(): ConfigLogger {
    if (!ConfigLogger.instance) {
      ConfigLogger.instance = new ConfigLogger();
    }
    return ConfigLogger.instance;
  }

  log({ level, message, context }: ConfigLogOptions): void {
    if (!this.enabled) return;

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [CONFIG]`;

    switch (level) {
      case ConfigLogLevel.WARN:
        console.warn(`${prefix} ⚠️  ${message}`, context || '');
        break;
      case ConfigLogLevel.ERROR:
        console.error(`${prefix} ❌ ${message}`, context || '');
        break;
      case ConfigLogLevel.INFO:
      default:
        console.log(`${prefix} ℹ️  ${message}`, context || '');
        break;
    }
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log({ level: ConfigLogLevel.WARN, message, context });
  }

  info(message: string, context?: Record<string, any>): void {
    this.log({ level: ConfigLogLevel.INFO, message, context });
  }

  error(message: string, context?: Record<string, any>): void {
    this.log({ level: ConfigLogLevel.ERROR, message, context });
  }

  disable(): void {
    this.enabled = false;
  }

  enable(): void {
    this.enabled = true;
  }
}

export const configLogger = ConfigLogger.getInstance();
