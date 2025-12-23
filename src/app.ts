import Koa from 'koa';
import { createServer } from 'http';
import config from './config';
import middleware from './middleware';
import routes from './routes';

class App {
  private app: Koa;

  constructor() {
    this.app = new Koa();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    middleware(this.app);
  }

  private setupRoutes(): void {
    routes(this.app);
  }

  public start(): void {
    const server = createServer(this.app.callback());
    server.listen(config.port, () => {
      console.log(`
🚀  ${config.appName} 启动成功！
📁  环境: ${config.env}
📍  地址: http://localhost:${config.port} (${config.appUrl})
📊  API 前缀: ${config.apiPrefix}/${config.apiVersion}
📈  日志级别: ${config.logLevel}
📅  时间: ${new Date().toISOString()}
      `);

      // 1.3版本新增：显示Swagger文档地址
      if (config.enableSwagger) {
        console.log(`📖  API文档: http://localhost:${config.port}/api-docs`);
        console.log(
          `📄  Swagger JSON: http://localhost:${config.port}/swagger.json`,
        );
      }
    });
  }
}

export default App;
