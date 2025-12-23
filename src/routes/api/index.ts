import Router from 'koa-router';
import os from 'os';

const router = new Router();

/**
 * @swagger
 * tags:
 *   name: 系统
 *   description: 系统相关接口
 */

/**
 * @swagger
 * /api:
 *   get:
 *     summary: API欢迎信息
 *     description: 返回API的基本信息和版本
 *     tags: [系统]
 *     responses:
 *       200:
 *         description: 成功响应
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Hello from API!
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 version:
 *                   type: string
 *                   example: 1.0.0
 */
router.get('/', async (ctx) => {
  ctx.body = {
    message: 'Hello from API!',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  };
});

/**
 * @swagger
 * tags:
 *   name: 健康检查
 *   description: 健康检查接口
 */

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: 健康检查
 *     description: 返回系统健康状况和基本信息
 *     tags: [健康检查]
 *     responses:
 *       200:
 *         description: 系统健康
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: OK
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   example: 1234.56
 *                 memory:
 *                   type: object
 *                 cpu:
 *                   type: array
 *                   items:
 *                     type: number
 *                 environment:
 *                   type: string
 *                   example: development
 */
router.get('/health', async (ctx) => {
  ctx.body = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: os.loadavg(),
    environment: process.env.NODE_ENV || 'development',
  };
});

/**
 * @swagger
 * /api/status:
 *   get:
 *     summary: 应用状态
 *     description: 返回应用状态和可用端点
 *     tags: [系统]
 *     responses:
 *       200:
 *         description: 应用状态信息
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 app:
 *                   type: string
 *                   example: Koa Template App
 *                 version:
 *                   type: string
 *                   example: 1.0.0
 *                 status:
 *                   type: string
 *                   example: running
 *                 endpoints:
 *                   type: array
 *                   items:
 *                     type: string
 */
router.get('/status', async (ctx) => {
  ctx.body = {
    app: 'Koa Template App',
    version: '1.0.0',
    status: 'running',
    endpoints: ['/api', '/api/health', '/api/status', '/api/echo/:message'],
  };
});

/**
 * @swagger
 * /api/echo/{message}:
 *   get:
 *     summary: 消息回显
 *     description: 回显输入的消息，支持重复参数
 *     tags: [系统]
 *     parameters:
 *       - in: path
 *         name: message
 *         required: true
 *         schema:
 *           type: string
 *         description: 要回显的消息
 *       - in: query
 *         name: repeat
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 重复次数
 *     responses:
 *       200:
 *         description: 回显成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 original:
 *                   type: string
 *                 repeated:
 *                   type: string
 *                 length:
 *                   type: integer
 *                 echoedAt:
 *                   type: string
 *                   format: date-time
 */
router.get('/echo/:message', async (ctx) => {
  const { message } = ctx.params;
  const { repeat = '1' } = ctx.query;

  const repeatedMessage = message.repeat(parseInt(repeat as string) || 1);

  ctx.body = {
    original: message,
    repeated: repeatedMessage,
    length: repeatedMessage.length,
    echoedAt: new Date().toISOString(),
  };
});

/**
 * @swagger
 * /api/echo:
 *   post:
 *     summary: POST消息回显
 *     description: 通过POST请求回显消息
 *     tags: [系统]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 example: 测试消息
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: 回显成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 received:
 *                   type: object
 *                 processedAt:
 *                   type: string
 *                   format: date-time
 *                 serverInfo:
 *                   type: object
 */
router.post('/echo', async (ctx) => {
  const { message, timestamp } = ctx.request.body as any;

  ctx.body = {
    received: {
      message,
      timestamp: timestamp || new Date().toISOString(),
    },
    processedAt: new Date().toISOString(),
    serverInfo: {
      nodeVersion: process.version,
      platform: process.platform,
    },
  };
});

// 新增：速率限制测试端点
/**
 * @swagger
 * /api/rate-limit-test:
 *   get:
 *     summary: 速率限制测试
 *     description: 测试速率限制功能
 *     tags: [系统]
 *     responses:
 *       200:
 *         description: 测试成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 requestCount:
 *                   type: integer
 */
router.get('/rate-limit-test', async (ctx) => {
  ctx.body = {
    message: '速率限制测试端点',
    timestamp: new Date().toISOString(),
    requestCount: 1,
  };
});

export default router;
