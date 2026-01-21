// /src/app.ts - 集成UDP服务器
import Koa from 'koa';
import { createServer, Server } from 'http';
import config from './config';
import middleware from './middleware';
import routes from './routes';
import db from './db/connection';
import { UDPClient } from './udp/client'; // 改为UDP客户端
import { WebSocketManager } from './websocket/server';
import { cpeMetricsUpdater } from './monitor/services/cpe-metrics-updater';

class App {
  private app: Koa;
  private server: Server | null = null;
  private wsManager: WebSocketManager | null = null;
  private udpClient: UDPClient | null = null; // 改为UDP客户端

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
    const shutdownSignals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGUSR2'];

    shutdownSignals.forEach((signal) => {
      process.once(signal, async () => {
        console.log(`\n⚠️  收到 ${signal} 信号，正在关闭应用...`);
        await this.gracefulShutdown();
      });
    });

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
      // 2.2版本增加cpeMetricsUpdater
      console.log('⏳ 正在关闭CPE指标更新器...');
      cpeMetricsUpdater.stop(); // 新增：停止指标更新
      console.log('✅ CPE指标更新器已关闭');

      console.log('⏳ 正在关闭WebSocket服务器...');
      if (this.wsManager) {
        this.wsManager.close();
        console.log('✅ WebSocket服务器已关闭');
      }

      // 在 gracefulShutdown 方法中修改：
      console.log('⏳ 正在关闭UDP客户端...');
      if (this.udpClient) {
        this.udpClient.close();
        console.log('✅ UDP客户端已关闭');
      }

      console.log('⏳ 正在关闭北向接口服务器...');
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
        console.log('✅ 北向接口服务器已关闭');
      }

      console.log('⏳ 正在断开数据库连接...');
      await db.disconnect();
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

      // 1.1 启动CPE指标定时更新（放在数据库连接之后）
      if (config.env !== 'test') {
        cpeMetricsUpdater.start(60000); // 每60秒更新一次
        console.log('📊 CPE指标定时更新器已启动');
      }

      // 2. 创建UDP客户端（用于发送唤醒包） - 不再监听端口
      this.udpClient = new UDPClient();
      console.log('📢 UDP客户端已创建（用于发送唤醒包）');

      // 3. 创建Koa应用服务器（3000端口）
      this.server = createServer(this.app.callback());

      // 4. 创建WebSocket服务器（7547端口） - 南向接口
      const wsServer = createServer(); // 用于WebSocket的HTTP服务器
      wsServer.listen(config.wsPort, () => {
        console.log(`🌐 WebSocket服务器监听在 ${config.wsUrl}`);
      });

      // 5. 创建WebSocket管理器并注入到应用上下文
      this.wsManager = new WebSocketManager(wsServer);
      this.wsManager.setUdpClient(this.udpClient); // 注入UDP客户端
      this.app.context.wsManager = this.wsManager;
      this.app.context.udpClient = this.udpClient; // 添加UDP客户端到上下文

      // 6. 启动Koa应用服务器
      this.server.listen(config.port, () => {
        console.log(`
🚀  ${config.appName} 启动成功！
📁  环境: ${config.env}
📍  北向接口地址: http://localhost:${config.port} (${config.appUrl})
📡  南向接口地址: ${config.wsUrl}
📢  UDP唤醒端口: 7548 (CPE监听此端口)
📊  API 前缀: ${config.apiPrefix}/${config.apiVersion}
📈  日志级别: ${config.logLevel}
🗄️  数据库: ${config.mongodb.uri.replace(/:[^:]*@/, ':****@')}
📅  时间: ${new Date().toISOString()}
        `);

        // 显示管理界面地址
        console.log(
          `🖥️  管理界面: http://localhost:${config.port}/cpe/monitor`,
        );
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

      // 处理WebSocket服务器错误
      wsServer.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          console.error(`❌ WebSocket端口 ${config.wsPort} 已被占用`);
        } else {
          console.error('❌ WebSocket服务器错误:', error);
        }
        this.gracefulShutdown(1);
      });
    } catch (error) {
      console.error('❌ 应用启动失败:', error);
      await this.gracefulShutdown(1);
    }
  }

  public getApp(): Koa {
    return this.app;
  }

  public getServer(): Server | null {
    return this.server;
  }

  public getWebSocketManager(): WebSocketManager | null {
    return this.wsManager;
  }

  public getUdpClient(): UDPClient | null {
    return this.udpClient;
  }
}

export default App;
