// 全局类型声明
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production' | 'test';
    PORT: string;
    APP_NAME: string;
    LOG_LEVEL: string;
    API_PREFIX: string;
    API_VERSION: string;
    CORS_ORIGIN: string;
    CORS_CREDENTIALS: string;
    MONGODB_URI: string;
    JWT_SECRET: string;
    [key: string]: string;
  }
}

// 加上以上两句将引发大量编译错误
// declare module 'koa' {
//   interface Context {
//     wsManager?: import('../src/websocket/server').WebSocketManager;
//   }
// }

// declare module 'koa' {
//   interface Context {
//     wsManager?: any; // WebSocketManager类型
//     udpServer?: any; // UDPServer类型
//   }
// }

// 路径别名模块声明，避免TypeScript报错
declare module '@/utils';
declare module '@/utils/validator';
declare module '@/config';
declare module '@/middleware';
declare module '@/routes';
declare module '@/websocket';
