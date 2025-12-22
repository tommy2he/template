// 全局类型声明
declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: "development" | "production" | "test";
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
