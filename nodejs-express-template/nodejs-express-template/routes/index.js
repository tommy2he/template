const express = require('express');
const router = express.Router();

// 示例路由
router.get('/', (req, res) => {
  res.json({
    message: '路由模块工作正常',
    timestamp: new Date().toISOString(),
    routes: {
      example: '/example',
      users: '/users (示例)',
    },
  });
});

// 示例 API 端点
router.get('/example', (req, res) => {
  res.json({
    message: '这是一个示例路由',
    data: {
      id: 1,
      name: '示例项目',
      version: '1.0.0',
    },
  });
});

// 用户示例路由
router.get('/users', (req, res) => {
  res.json({
    message: '用户列表',
    users: [
      { id: 1, name: '张三', email: 'zhangsan@example.com' },
      { id: 2, name: '李四', email: 'lisi@example.com' },
      { id: 3, name: '王五', email: 'wangwu@example.com' },
    ],
  });
});

// 带参数的路由示例
router.get('/users/:id', (req, res) => {
  const userId = parseInt(req.params.id);

  if (userId > 0 && userId <= 3) {
    res.json({
      id: userId,
      name: `用户${userId}`,
      email: `user${userId}@example.com`,
    });
  } else {
    res.status(404).json({
      error: '用户不存在',
      requestedId: userId,
    });
  }
});

module.exports = router;
