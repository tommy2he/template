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
      console.log(`🚀 Server running on port ${config.port}`);
      console.log(`📁 Environment: ${config.env}`);
    });
  }
}

export default App;
