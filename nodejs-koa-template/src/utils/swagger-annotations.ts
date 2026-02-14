// /utils/swagger-annotations.ts
/**
 * Swagger注解管理工具
 * 集中管理所有Swagger注解，避免分散在各个路由文件中
 */

export const SwaggerTags = {
  SYSTEM: '系统',
  HEALTH: '健康检查',
  DEVICE: '设备管理',
} as const;

export const SwaggerSchemas = {
  Device: '#/components/schemas/Device',
  CreateDeviceRequest: '#/components/schemas/CreateDeviceRequest',
  UpdateDeviceRequest: '#/components/schemas/UpdateDeviceRequest',
} as const;

export const SwaggerPaths = {
  // ==================== 系统接口 ====================
  apiRoot: {
    get: {
      tags: [SwaggerTags.SYSTEM],
      summary: 'API欢迎信息',
      description: '返回API的基本信息和版本',
      responses: {
        '200': {
          description: '成功响应',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string', example: 'Hello from API!' },
                  timestamp: { type: 'string', format: 'date-time' },
                  version: { type: 'string', example: '1.0.0' },
                },
              },
            },
          },
        },
      },
    },
  },

  health: {
    get: {
      tags: [SwaggerTags.HEALTH],
      summary: '健康检查',
      description: '返回系统健康状况和基本信息',
      responses: {
        '200': {
          description: '系统健康',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', example: 'OK' },
                  timestamp: { type: 'string', format: 'date-time' },
                  uptime: { type: 'number', example: 1234.56 },
                  memory: {
                    type: 'object',
                    properties: {
                      rss: { type: 'number' },
                      heapTotal: { type: 'number' },
                      heapUsed: { type: 'number' },
                      external: { type: 'number' },
                    },
                  },
                  cpu: {
                    type: 'array',
                    items: { type: 'number' },
                    example: [0.5, 0.3, 0.2],
                  },
                  environment: { type: 'string', example: 'development' },
                },
              },
            },
          },
        },
      },
    },
  },

  status: {
    get: {
      tags: [SwaggerTags.SYSTEM],
      summary: '应用状态',
      description: '返回应用状态和可用端点',
      responses: {
        '200': {
          description: '应用状态信息',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  app: { type: 'string', example: 'Koa Template App' },
                  version: { type: 'string', example: '1.0.0' },
                  status: { type: 'string', example: 'running' },
                  endpoints: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },

  echoMessage: {
    get: {
      tags: [SwaggerTags.SYSTEM],
      summary: '消息回显',
      description: '回显输入的消息，支持重复参数',
      parameters: [
        {
          in: 'path',
          name: 'message',
          required: true,
          schema: { type: 'string' },
          description: '要回显的消息',
        },
        {
          in: 'query',
          name: 'repeat',
          schema: { type: 'integer', default: 1 },
          description: '重复次数',
        },
      ],
      responses: {
        '200': {
          description: '回显成功',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  original: { type: 'string' },
                  repeated: { type: 'string' },
                  length: { type: 'integer' },
                  echoedAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
      },
    },
  },

  echoPost: {
    post: {
      tags: [SwaggerTags.SYSTEM],
      summary: 'POST消息回显',
      description: '通过POST请求回显消息',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                message: { type: 'string', example: '测试消息' },
                timestamp: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: '回显成功',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  received: { type: 'object' },
                  processedAt: { type: 'string', format: 'date-time' },
                  serverInfo: { type: 'object' },
                },
              },
            },
          },
        },
      },
    },
  },

  rateLimitTest: {
    get: {
      tags: [SwaggerTags.SYSTEM],
      summary: '速率限制测试',
      description: '测试速率限制功能',
      responses: {
        '200': {
          description: '测试成功',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  timestamp: { type: 'string', format: 'date-time' },
                  requestCount: { type: 'integer' },
                },
              },
            },
          },
        },
        '429': {
          $ref: '#/components/responses/ErrorResponse',
        },
      },
    },
  },

  performance: {
    get: {
      tags: [SwaggerTags.SYSTEM],
      summary: '获取性能指标',
      description: '返回应用性能指标和系统状态',
      responses: {
        '200': {
          description: '性能指标',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  timestamp: { type: 'string', format: 'date-time' },
                  data: { type: 'object' },
                },
              },
            },
          },
        },
      },
    },
  },

  performanceReset: {
    post: {
      tags: [SwaggerTags.SYSTEM],
      summary: '重置性能指标',
      description: '重置性能监控数据',
      responses: {
        '200': {
          description: '重置成功',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string' },
                  timestamp: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
      },
    },
  },

  performanceHealth: {
    get: {
      tags: [SwaggerTags.HEALTH],
      summary: '详细健康检查',
      description: '返回详细的系统健康状态',
      responses: {
        '200': {
          description: '详细健康信息',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', example: 'OK' },
                  timestamp: { type: 'string', format: 'date-time' },
                  process: { type: 'object' },
                  system: { type: 'object' },
                },
              },
            },
          },
        },
      },
    },
  },

  // ==================== 设备管理接口 ====================
  devices: {
    get: {
      tags: [SwaggerTags.DEVICE],
      summary: '获取设备列表',
      description: '获取设备列表，支持分页、过滤和排序',
      parameters: [
        { $ref: '#/components/parameters/PageParam' },
        { $ref: '#/components/parameters/LimitParam' },
        {
          in: 'query',
          name: 'status',
          schema: {
            type: 'string',
            enum: ['online', 'offline', 'provisioning', 'maintenance'],
          },
          description: '设备状态过滤',
        },
        {
          in: 'query',
          name: 'sortBy',
          schema: { type: 'string', default: 'lastSeen' },
          description: '排序字段',
        },
        {
          in: 'query',
          name: 'sortOrder',
          schema: { type: 'string', default: '-1', enum: ['1', '-1'] },
          description: '排序顺序（1升序，-1降序）',
        },
      ],
      responses: {
        '200': {
          description: '设备列表',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: {
                    type: 'array',
                    items: { $ref: SwaggerSchemas.Device },
                  },
                  pagination: {
                    type: 'object',
                    properties: {
                      page: { type: 'integer', example: 1 },
                      limit: { type: 'integer', example: 20 },
                      total: { type: 'integer', example: 100 },
                      pages: { type: 'integer', example: 5 },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    post: {
      tags: [SwaggerTags.DEVICE],
      summary: '创建设备',
      description: '创建一个新的设备',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: SwaggerSchemas.CreateDeviceRequest },
          },
        },
      },
      responses: {
        '201': {
          description: '设备创建成功',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: { $ref: SwaggerSchemas.Device },
                },
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/ErrorResponse' },
        '409': { $ref: '#/components/responses/ErrorResponse' },
        '500': { $ref: '#/components/responses/ErrorResponse' },
      },
    },
  },

  deviceById: {
    get: {
      tags: [SwaggerTags.DEVICE],
      summary: '获取单个设备',
      description: '根据ID获取单个设备的详细信息',
      parameters: [{ $ref: '#/components/parameters/DeviceIdParam' }],
      responses: {
        '200': {
          description: '设备信息',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: { $ref: SwaggerSchemas.Device },
                },
              },
            },
          },
        },
        '404': { $ref: '#/components/responses/ErrorResponse' },
        '500': { $ref: '#/components/responses/ErrorResponse' },
      },
    },

    put: {
      tags: [SwaggerTags.DEVICE],
      summary: '更新设备',
      description: '更新设备的全部信息',
      parameters: [{ $ref: '#/components/parameters/DeviceIdParam' }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: SwaggerSchemas.UpdateDeviceRequest },
          },
        },
      },
      responses: {
        '200': {
          description: '设备更新成功',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: { $ref: SwaggerSchemas.Device },
                },
              },
            },
          },
        },
        '404': { $ref: '#/components/responses/ErrorResponse' },
        '409': { $ref: '#/components/responses/ErrorResponse' },
        '500': { $ref: '#/components/responses/ErrorResponse' },
      },
    },

    delete: {
      tags: [SwaggerTags.DEVICE],
      summary: '删除设备',
      description: '根据ID删除设备',
      parameters: [{ $ref: '#/components/parameters/DeviceIdParam' }],
      responses: {
        '200': {
          description: '设备删除成功',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: { type: 'string', example: '设备删除成功' },
                },
              },
            },
          },
        },
        '404': { $ref: '#/components/responses/ErrorResponse' },
        '500': { $ref: '#/components/responses/ErrorResponse' },
      },
    },
  },

  deviceParameters: {
    patch: {
      tags: [SwaggerTags.DEVICE],
      summary: '更新设备参数',
      description: '更新设备的参数部分',
      parameters: [{ $ref: '#/components/parameters/DeviceIdParam' }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                parameters: {
                  type: 'object',
                  additionalProperties: true,
                },
              },
            },
          },
        },
      },
      responses: {
        '200': {
          description: '参数更新成功',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: { $ref: SwaggerSchemas.Device },
                },
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/ErrorResponse' },
        '404': { $ref: '#/components/responses/ErrorResponse' },
        '500': { $ref: '#/components/responses/ErrorResponse' },
      },
    },
  },

  devicesSearch: {
    get: {
      tags: [SwaggerTags.DEVICE],
      summary: '搜索设备',
      description: '根据关键词搜索设备',
      parameters: [
        {
          in: 'query',
          name: 'q',
          required: true,
          schema: { type: 'string' },
          description: '搜索关键词',
        },
        { $ref: '#/components/parameters/PageParam' },
        { $ref: '#/components/parameters/LimitParam' },
      ],
      responses: {
        '200': {
          description: '搜索结果',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: {
                    type: 'array',
                    items: { $ref: SwaggerSchemas.Device },
                  },
                  pagination: {
                    type: 'object',
                    properties: {
                      page: { type: 'integer', example: 1 },
                      limit: { type: 'integer', example: 20 },
                      total: { type: 'integer', example: 5 },
                    },
                  },
                },
              },
            },
          },
        },
        '400': { $ref: '#/components/responses/ErrorResponse' },
        '500': { $ref: '#/components/responses/ErrorResponse' },
      },
    },
  },

  devicesStats: {
    get: {
      tags: [SwaggerTags.DEVICE],
      summary: '获取设备统计信息',
      description: '获取设备的统计信息，如总数、在线数等',
      responses: {
        '200': {
          description: '设备统计信息',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: {
                    type: 'object',
                    properties: {
                      total: { type: 'integer', example: 100 },
                      online: { type: 'integer', example: 80 },
                      offline: { type: 'integer', example: 15 },
                      provisioning: { type: 'integer', example: 3 },
                      maintenance: { type: 'integer', example: 2 },
                      onlinePercentage: { type: 'integer', example: 80 },
                    },
                  },
                },
              },
            },
          },
        },
        '500': { $ref: '#/components/responses/ErrorResponse' },
      },
    },
  },
};

/**
 * 合并Swagger配置到主配置
 */
export function mergeSwaggerConfig(baseConfig: any, paths: any) {
  return {
    ...baseConfig,
    paths: {
      ...baseConfig.paths,
      ...paths,
    },
  };
}

/**
 * 创建路径映射
 */
export function createPathsMapping() {
  return {
    '/api': SwaggerPaths.apiRoot,
    '/api/health': SwaggerPaths.health,
    '/api/status': SwaggerPaths.status,
    '/api/echo/{message}': SwaggerPaths.echoMessage,
    '/api/echo': SwaggerPaths.echoPost,
    '/api/rate-limit-test': SwaggerPaths.rateLimitTest,
    '/api/performance': SwaggerPaths.performance,
    '/api/performance/reset': SwaggerPaths.performanceReset,
    '/api/performance/health': SwaggerPaths.performanceHealth,
    '/api/devices': SwaggerPaths.devices,
    '/api/devices/{id}': SwaggerPaths.deviceById,
    '/api/devices/{id}/parameters': SwaggerPaths.deviceParameters,
    '/api/devices/search': SwaggerPaths.devicesSearch,
    '/api/devices/stats': SwaggerPaths.devicesStats,
  };
}
