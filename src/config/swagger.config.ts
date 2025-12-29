// /config/swagger.config.ts
import { OpenAPIV3 } from 'openapi-types';

export const swaggerConfig: OpenAPIV3.Document = {
  openapi: '3.0.0',
  info: {
    title: 'Koa Template App API',
    version: '1.0.0',
    description: 'Koa模板应用的API文档',
    contact: {
      name: 'API Support',
      email: 'support@example.com',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: '本地开发服务器',
    },
    {
      url: 'http://localhost:{port}',
      description: '通用服务器',
      variables: {
        port: {
          default: '3000',
          description: '服务器端口',
        },
      },
    },
  ],
  tags: [
    {
      name: '系统',
      description: '系统相关接口',
    },
    {
      name: '健康检查',
      description: '健康检查接口',
    },
    {
      name: '设备管理',
      description: '设备管理相关接口',
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
    schemas: {
      Device: {
        type: 'object',
        properties: {
          _id: {
            type: 'string',
            description: '设备ID（数据库内部ID）',
          },
          deviceId: {
            type: 'string',
            description: '设备标识符',
          },
          manufacturer: {
            type: 'string',
            description: '制造商',
          },
          model: {
            type: 'string',
            description: '型号',
          },
          firmwareVersion: {
            type: 'string',
            description: '固件版本',
          },
          ipAddress: {
            type: 'string',
            description: 'IP地址',
          },
          status: {
            type: 'string',
            enum: ['online', 'offline', 'provisioning', 'maintenance'],
            description: '设备状态',
          },
          lastSeen: {
            type: 'string',
            format: 'date-time',
            description: '最后在线时间',
          },
          parameters: {
            type: 'object',
            additionalProperties: true,
            description: '设备参数',
          },
          tags: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: '设备标签',
          },
          metadata: {
            type: 'object',
            additionalProperties: true,
            description: '元数据',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: '创建时间',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: '更新时间',
          },
        },
      },
      CreateDeviceRequest: {
        type: 'object',
        required: ['deviceId', 'manufacturer', 'model', 'ipAddress'],
        properties: {
          deviceId: {
            type: 'string',
            description: '设备标识符（必须唯一）',
          },
          manufacturer: {
            type: 'string',
            description: '制造商',
          },
          model: {
            type: 'string',
            description: '型号',
          },
          firmwareVersion: {
            type: 'string',
            description: '固件版本',
            default: '1.0.0',
          },
          ipAddress: {
            type: 'string',
            description: 'IP地址',
            pattern: '^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$',
          },
          status: {
            type: 'string',
            enum: ['online', 'offline', 'provisioning', 'maintenance'],
            default: 'offline',
          },
          parameters: {
            type: 'object',
            additionalProperties: true,
          },
          tags: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          metadata: {
            type: 'object',
            additionalProperties: true,
          },
        },
      },
      UpdateDeviceRequest: {
        type: 'object',
        properties: {
          deviceId: {
            type: 'string',
            description: '设备标识符（如果修改，必须保持唯一）',
          },
          manufacturer: {
            type: 'string',
          },
          model: {
            type: 'string',
          },
          firmwareVersion: {
            type: 'string',
          },
          ipAddress: {
            type: 'string',
            pattern: '^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$',
          },
          status: {
            type: 'string',
            enum: ['online', 'offline', 'provisioning', 'maintenance'],
          },
          parameters: {
            type: 'object',
            additionalProperties: true,
          },
          tags: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          metadata: {
            type: 'object',
            additionalProperties: true,
          },
        },
      },
    },
    responses: {
      SuccessResponse: {
        description: '成功响应',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: {
                  type: 'boolean',
                  example: true,
                },
                message: {
                  type: 'string',
                  example: '操作成功',
                },
                data: {
                  type: 'object',
                },
                timestamp: {
                  type: 'string',
                  format: 'date-time',
                },
              },
            },
          },
        },
      },
      ErrorResponse: {
        description: '错误响应',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                success: {
                  type: 'boolean',
                  example: false,
                },
                error: {
                  type: 'string',
                  example: '错误信息',
                },
                code: {
                  type: 'string',
                  example: 'ERROR_CODE',
                },
                timestamp: {
                  type: 'string',
                  format: 'date-time',
                },
              },
            },
          },
        },
      },
    },
    parameters: {
      PageParam: {
        in: 'query',
        name: 'page',
        schema: {
          type: 'integer',
          default: 1,
          minimum: 1,
        },
        description: '页码',
      },
      LimitParam: {
        in: 'query',
        name: 'limit',
        schema: {
          type: 'integer',
          default: 20,
          minimum: 1,
          maximum: 100,
        },
        description: '每页数量',
      },
      DeviceIdParam: {
        in: 'path',
        name: 'id',
        required: true,
        schema: {
          type: 'string',
        },
        description: '设备ID',
      },
    },
  },
  paths: {}, // 留空，由路由文件动态填充
};
