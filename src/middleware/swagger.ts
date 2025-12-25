import { Context } from 'koa';
import swaggerJSDoc from 'swagger-jsdoc';
import { koaSwagger } from 'koa2-swagger-ui';
import path from 'path';
import config from '../config';

// Swagger配置
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Koa Template App API',
    version: '1.0.0',
    description: 'Koa模板应用的API文档',
    contact: {
      name: '开发者',
      email: 'developer@example.com',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: `http://localhost:${config.port}`,
      description: '本地开发服务器',
    },
    {
      url: config.appUrl,
      description: '生产服务器',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  tags: [
    {
      name: '系统',
      description: '系统相关接口',
    },
    {
      name: '健康检查',
      description: '健康检查接口',
    },
  ],
  externalDocs: {
    description: '了解更多',
    url: 'https://github.com/yourusername/koa_template_app',
  },
};

// Swagger JSDoc配置
const options = {
  swaggerDefinition,
  apis: [
    path.join(__dirname, '../routes/**/*.ts'),
    path.join(__dirname, '../types/**/*.d.ts'),
  ],
};

const swaggerSpec = swaggerJSDoc(options);

// 生成Swagger JSON端点
export function swaggerJSON() {
  return (ctx: Context) => {
    ctx.set('Content-Type', 'application/json');
    ctx.body = swaggerSpec;
  };
}

// Swagger UI中间件
export function swaggerUI() {
  return koaSwagger({
    routePrefix: '/api-docs',
    swaggerOptions: {
      url: '/swagger.json',
      docExpansion: 'list',
      filter: true,
      showRequestHeaders: true,
    },
    hideTopbar: false,
    favicon: '/favicon.ico',
    title: 'Koa Template App API文档',
  });
}

// 验证Swagger配置
export function validateSwaggerConfig() {
  if (!swaggerSpec) {
    throw new Error('Swagger配置生成失败');
  }

  console.log('✅ Swagger文档生成成功');
  console.log(`📖 文档地址: http://localhost:${config.port}/api-docs`);
  console.log(`📄 JSON地址: http://localhost:${config.port}/swagger.json`);

  return true;
}
