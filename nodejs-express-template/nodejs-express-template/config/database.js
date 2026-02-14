// 选项A：删除（如果确定不用）
// rm config/database.js

// 选项B：保留并简化为示例
// config/database.js
module.exports = {
  // 数据库连接配置示例
  development: {
    client: 'sqlite3',
    connection: {
      filename: './dev.db',
    },
  },
  // 生产环境配置示例
  production: {
    client: 'postgresql',
    connection: {
      host: 'localhost',
      database: 'myapp',
      user: 'username',
      password: 'password',
    },
  },
};
