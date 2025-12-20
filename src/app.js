const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

// 路由导入
const routes = require('../routes/index.js');

// 创建 Express 应用
const app = express();

// 安全中间件
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
        scriptSrc: ["'self'", 'https://cdnjs.cloudflare.com'],
        fontSrc: ["'self'", 'https://cdnjs.cloudflare.com', 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ********** 重要：先定义所有路由，再定义静态文件服务 **********

// 基本路由
app.get('/', (req, res) => {
  // 这行代码仅用于调试版
  // console.log('🔍 根路径路由被调用，Accept:', req.headers.accept);

  const accept = req.headers.accept || '';

  if (accept.includes('application/json')) {
    res.json({
      message: '欢迎使用 Node.js 学习项目 API',
      version: '1.0.0',
      endpoints: {
        root: '/',
        health: '/health',
        apiInfo: '/api/info',
        apiExample: '/api/example',
        frontend: '/index.html',
      },
      timestamp: new Date().toISOString(),
      note: '访问 /index.html 查看前端页面',
    });
  } else {
    res.redirect('/index.html');
  }
});

// 健康检查路由
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// API 信息路由
app.get('/api/info', (req, res) => {
  res.json({
    nodeVersion: process.version,
    platform: process.platform,
    memoryUsage: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// 回显路由（用于测试 POST 请求）
app.post('/api/echo', (req, res) => {
  res.json({
    received: req.body,
    timestamp: new Date().toISOString(),
  });
});

// API 路由
app.use('/api', routes);

// ********** 静态文件服务放在最后（兜底）**********
app.use(express.static('public'));

// 404 处理（在静态文件服务之后）
app.use((req, res) => {
  console.log(`404: ${req.method} ${req.url}`);
  res.status(404).json({
    error: '找不到请求的资源',
    path: req.path,
    method: req.method,
  });
});

// 错误处理中间件
app.use((err, req, res, _next) => {
  console.error('服务器错误:', err);

  const statusCode = err.status || err.statusCode || 500;
  const errorResponse = {
    error: err.name || 'Internal Server Error',
    message: err.message || 'Something went wrong',
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  };

  res.status(statusCode).json(errorResponse);
});

module.exports = app;
