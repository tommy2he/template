import Koa from 'koa';
import { createServer, Server } from 'http';
import config from './config';
import middleware from './middleware';
import routes from './routes';
import db from './db/connection';
import { validateSwaggerConfig } from './middleware/swagger';
import { WebSocketManager } from './websocket/server';

class App {
  private app: Koa;
  private server: Server | null = null;
  private wsManager: WebSocketManager | null = null;

  constructor() {
    this.app = new Koa();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupGracefulShutdown();
  }

  private setupMiddleware(): void {
    middleware(this.app);
  }

  private setupRoutes(): void {
    routes(this.app);
  }

  private setupGracefulShutdown(): void {
    // 处理进程终止信号
    const shutdownSignals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGUSR2'];

    shutdownSignals.forEach((signal) => {
      process.once(signal, async () => {
        console.log(`\n⚠️  收到 ${signal} 信号，正在关闭应用...`);
        await this.gracefulShutdown();
      });
    });

    // 处理未捕获的异常和未处理的Promise拒绝
    process.on('uncaughtException', async (error) => {
      console.error('❌ 未捕获的异常:', error);
      await this.gracefulShutdown(1);
    });

    process.on('unhandledRejection', async (_promise, reason) => {
      console.error('❌ 未处理的Promise拒绝:', reason);
      await this.gracefulShutdown(1);
    });
  }

  private async gracefulShutdown(exitCode = 0): Promise<void> {
    try {
      console.log('⏳ 正在关闭WebSocket服务器...');
      if (this.wsManager) {
        this.wsManager.close();
        console.log('✅ WebSocket服务器已关闭');
      }

      console.log('⏳ 正在关闭HTTP服务器...');
      if (this.server) {
        await new Promise<void>((resolve, reject) => {
          this.server!.close((err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        });
        console.log('✅ HTTP服务器已关闭');
      }

      console.log('⏳ 正在断开数据库连接...');
      await db.disconnect(); // 断开数据库连接
      console.log('✅ 数据库连接已断开');

      console.log('👋 应用关闭完成');
      process.exit(exitCode);
    } catch (error) {
      console.error('❌ 关闭过程中发生错误:', error);
      process.exit(1);
    }
  }

  public async start(): Promise<void> {
    try {
      // 1. 先连接数据库
      console.log('⏳ 正在连接数据库...');
      await db.connect();

      // 2. 验证Swagger配置（如果启用）
      if (config.enableSwagger && config.env !== 'production') {
        validateSwaggerConfig();
      }

      // 3. 创建HTTP服务器
      this.server = createServer(this.app.callback());

      // 4. 创建WebSocket服务器并注入到应用上下文
      this.wsManager = new WebSocketManager(this.server);
      this.app.context.wsManager = this.wsManager;

      // 5. 启动服务器监听
      this.server.listen(config.port, () => {
        console.log(`
🚀  ${config.appName} 启动成功！
📁  环境: ${config.env}
📍  地址: http://localhost:${config.port} (${config.appUrl})
📊  API 前缀: ${config.apiPrefix}/${config.apiVersion}
📈  日志级别: ${config.logLevel}
🗄️  数据库: ${config.mongodb.uri.replace(/:[^:]*@/, ':****@')}
🌐  WebSocket: ws://localhost:${config.port}
📅  时间: ${new Date().toISOString()}
        `);

        // 显示Swagger文档地址
        if (config.enableSwagger) {
          console.log(`📖  API文档: http://localhost:${config.port}/api-docs`);
          console.log(
            `📄  Swagger JSON: http://localhost:${config.port}/swagger.json`,
          );
        }
      });

      // 处理服务器错误
      this.server.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          console.error(`❌ 端口 ${config.port} 已被占用`);
        } else {
          console.error('❌ 服务器错误:', error);
        }
        this.gracefulShutdown(1);
      });
    } catch (error) {
      console.error('❌ 应用启动失败:', error);
      await this.gracefulShutdown(1);
    }
  }

  // 获取Koa应用实例（用于测试）
  public getApp(): Koa {
    return this.app;
  }

  // 获取HTTP服务器实例（用于测试）
  public getServer(): Server | null {
    return this.server;
  }

  // 获取WebSocket管理器实例（用于测试）
  public getWebSocketManager(): WebSocketManager | null {
    return this.wsManager;
  }
}

export default App;
