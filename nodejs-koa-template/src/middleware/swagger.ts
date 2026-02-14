// /middleware/swagger.ts - 修正版
import { Context } from 'koa';
import { koaSwagger } from 'koa2-swagger-ui';
import swaggerJSDoc from 'swagger-jsdoc';
import path from 'path';
import config from '../config';
import { swaggerConfig } from '../config/swagger.config';
import { createPathsMapping } from '../utils/swagger-annotations';

// 生成Swagger规范
const generateSwaggerSpec = () => {
  // 合并路径配置
  const paths = createPathsMapping();
  const mergedConfig = {
    ...swaggerConfig,
    paths,
  };

  const options = {
    swaggerDefinition: mergedConfig,
    apis: [path.join(__dirname, '../routes/**/*.ts')],
  };

  return swaggerJSDoc(options);
};

// 使用单例模式避免重复生成
let swaggerSpecInstance: any = null;

export const getSwaggerSpec = () => {
  if (!swaggerSpecInstance) {
    swaggerSpecInstance = generateSwaggerSpec();
  }
  return swaggerSpecInstance;
};

// Swagger UI中间件
export function swaggerUI() {
  return koaSwagger({
    routePrefix: '/api-docs',
    swaggerOptions: {
      spec: getSwaggerSpec(),
      docExpansion: 'list',
      filter: true,
      showRequestHeaders: true,
      tryItOutEnabled: true,
      displayRequestDuration: true,
      persistAuthorization: true,
      // 将 theme 配置放在这里
      // 注意：某些版本的 koa2-swagger-ui 可能不支持 theme 配置
      // 如果仍有问题，可以注释掉这行
      theme: 'material',
    },
    hideTopbar: false,
    favicon: '/favicon.ico',
    title: 'Koa Template App API文档',
  });
}

// 如果上面的 theme 配置仍有问题，使用这个简化版本
export function swaggerUISimple() {
  return koaSwagger({
    routePrefix: '/api-docs',
    swaggerOptions: {
      spec: getSwaggerSpec(),
      docExpansion: 'list',
      filter: true,
      showRequestHeaders: true,
      tryItOutEnabled: true,
      displayRequestDuration: true,
    },
    hideTopbar: false,
    favicon: '/favicon.ico',
    title: 'Koa Template App API文档',
  });
}

// /middleware/swagger.ts - 优化版
export function swaggerUIOptimized() {
  const swaggerOptions: any = {
    spec: getSwaggerSpec(),
    docExpansion: 'list',
    filter: true,
    showRequestHeaders: true,
    tryItOutEnabled: true,
    displayRequestDuration: true,
    defaultModelsExpandDepth: '1',
    defaultModelExpandDepth: '1',
    defaultModelRendering: 'example',
    displayOperationId: false,
    showExtensions: true,
    showCommonExtensions: true,
    tagsSorter: 'alpha',
    operationsSorter: 'alpha',
    syntaxHighlight: {
      activate: true,
      theme: 'agate',
    },
    requestSnippetsEnabled: true,
    requestSnippets: {
      generators: {
        curl_bash: {
          title: 'cURL (bash)',
          syntax: 'bash',
        },
        curl_powershell: {
          title: 'cURL (PowerShell)',
          syntax: 'powershell',
        },
        curl_cmd: {
          title: 'cURL (CMD)',
          syntax: 'bash',
        },
      },
      defaultExpanded: true,
      languages: null,
    },
  };

  return koaSwagger({
    routePrefix: '/api-docs',
    swaggerOptions: swaggerOptions,
    hideTopbar: false,
    favicon: '/favicon.ico',
    title: 'Koa Template App API文档',
    customCss: `
      /* ========== 统一界面样式 ========== */
      /* 1. 统一字体 */
      body, .swagger-ui .opblock .opblock-summary-description,
      .swagger-ui .model-title, .swagger-ui .parameter__type,
      .swagger-ui table thead th, .swagger-ui .response-col_status,
      .swagger-ui .response-col_links {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
      }
      
      /* 2. 统一间距 */
      .swagger-ui .opblock {
        margin-bottom: 16px !important;
        border-radius: 8px !important;
      }
      
      .swagger-ui .model-container {
        margin: 16px 0 !important;
        border-radius: 8px !important;
        border: 1px solid #e0e0e0 !important;
        background: #fff !important;
      }
      
      /* 3. 统一卡片阴影 */
      .swagger-ui .opblock, .swagger-ui .model-container {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08) !important;
      }
      
      /* 4. 统一标题样式 */
      .swagger-ui .info .title {
        font-size: 28px !important;
        font-weight: 600 !important;
        color: #1e1e1e !important;
        margin-bottom: 8px !important;
      }
      
      .model-title {
        font-size: 16px !important;
        font-weight: 600 !important;
        color: #1e1e1e !important;
        margin-bottom: 12px !important;
        padding-bottom: 8px !important;
        border-bottom: 1px solid #f0f0f0 !important;
      }
      
      /* 5. 统一描述文本 */
      .swagger-ui .info .description, 
      .opblock-summary-description {
        color: #666 !important;
        font-size: 14px !important;
        line-height: 1.6 !important;
      }
      
      /* 6. 统一代码块 */
      .swagger-ui .microlight {
        font-family: 'JetBrains Mono', 'Fira Code', monospace !important;
        font-size: 13px !important;
        border-radius: 6px !important;
      }
      
      /* 7. 统一表格样式 */
      .swagger-ui table thead tr {
        background-color: #f8f9fa !important;
      }
      
      .swagger-ui table tbody tr:nth-child(odd) {
        background-color: #fafafa !important;
      }
      
      /* 8. 统一按钮样式 */
      .swagger-ui .btn {
        border-radius: 6px !important;
        font-weight: 500 !important;
        padding: 8px 16px !important;
      }
      
      /* 9. 统一标签样式 */
      .swagger-ui .tab li {
        border-radius: 6px 6px 0 0 !important;
        margin-right: 4px !important;
      }
      
      /* 10. 统一响应区域 */
      .swagger-ui .responses-inner {
        padding: 20px !important;
      }
      
      /* 11. 暗色模式适配 */
      @media (prefers-color-scheme: dark) {
        .swagger-ui {
          background: #1e1e1e !important;
        }
        
        .swagger-ui .info .title {
          color: #e0e0e0 !important;
        }
        
        .swagger-ui .model-container {
          background: #2d2d2d !important;
          border-color: #444 !important;
        }
        
        .model-title {
          color: #e0e0e0 !important;
          border-color: #444 !important;
        }
      }
    `,
  } as any); // 注意，这里将整个配置对象断言为 any，因为 customCss 不在类型定义中
}

// Swagger JSON端点
export function swaggerJSON() {
  return (ctx: Context) => {
    ctx.set('Content-Type', 'application/json');
    ctx.body = getSwaggerSpec();
  };
}

// 验证Swagger配置
export function validateSwaggerConfig() {
  const spec = getSwaggerSpec();

  if (!spec) {
    throw new Error('Swagger配置生成失败');
  }

  // 检查必要部分
  if (!spec.openapi || !spec.info || !spec.paths) {
    throw new Error('Swagger配置不完整');
  }

  console.log('✅ Swagger文档生成成功');
  console.log(`📖 文档地址: http://localhost:${config.port}/api-docs`);
  console.log(`📄 JSON地址: http://localhost:${config.port}/swagger.json`);

  // 统计接口数量
  const endpointCount = Object.keys(spec.paths).length;
  console.log(`📊 接口数量: ${endpointCount}个`);

  return true;
}
