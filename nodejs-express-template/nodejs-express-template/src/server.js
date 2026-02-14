const app = require('./app');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

const PORT = process.env.PORT || 3000;

// 启动服务器
app.listen(PORT, () => {
  console.log(`
  ==================================
  服务器启动成功！
  ==================================
  环境: ${process.env.NODE_ENV || 'development'}
  地址: http://localhost:${PORT}
  时间: ${new Date().toLocaleString()}
  ==================================
  `);
});
