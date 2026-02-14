// jest.setup.js
// 在所有测试套件运行前执行一次

// ========== 1. 环境变量设置 ==========
process.env.NODE_ENV = 'test';

// 禁用dotenv日志
process.env.DOTENV_CONFIG_SILENT = 'true';
process.env.DOTENV_CONFIG_DEBUG = 'false';

// 设置测试特定的环境变量
process.env.LOG_LEVEL = 'error';
process.env.ENABLE_SWAGGER = 'false';
process.env.SWAGGER_ENABLED = 'false';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.HELMET_ENABLED = 'false';
process.env.COMPRESSION_ENABLED = 'false';
process.env.PERFORMANCE_MONITORING_ENABLED = 'false';

console.log('[测试环境] 模式:', process.env.NODE_ENV);

// ========== 2. 全局错误处理 ==========
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 测试套件中发生了未处理的 Promise 拒绝:');
  throw reason;
});

// ========== 3. 全局测试设置 ==========
jest.setTimeout(10000); // 10秒超时

// ========== 4. 清理控制台输出 ==========
// 可选：在测试时隐藏某些日志
if (process.env.NODE_ENV === 'test') {
  const originalLog = console.log;
  const originalInfo = console.info;

  console.log = (...args) => {
    if (!args[0] || !args[0].includes('[测试环境]')) {
      return; // 在测试中静默普通日志
    }
    originalLog(...args);
  };

  console.info = () => {}; // 完全静默info日志
}

// jest.setup.js - 完整实用版
// 此文件在所有测试套件运行前执行一次。用于设置全局测试环境。

// ========== 1. 环境变量设置 ==========
// 这是最主要的用途，确保测试使用独立的配置。
// process.env.NODE_ENV = 'test';
// 你可以根据 .env.test 文件的内容，在此覆盖或设置其他变量
// 例如：process.env.LOG_LEVEL = 'silent';

// 禁用dotenv日志（测试中输出太多）
// process.env.DOTENV_CONFIG_SILENT = 'true';
// process.env.DOTENV_CONFIG_DEBUG = 'false';

// console.log('[测试环境] 模式:', process.env.NODE_ENV);

// 设置测试特定的环境变量
// process.env.LOG_LEVEL = 'error'; // 测试环境只记录错误
// process.env.ENABLE_SWAGGER = 'false'; // 测试环境禁用Swagger

// ========== 2. 全局错误与警告处理 ==========
// 捕获未处理的Promise拒绝，防止静默失败。
// process.on('unhandledRejection', (reason, promise) => {
// 将错误提升为测试失败，而非仅打印
//   console.error('❌ 测试套件中发生了未处理的 Promise 拒绝:');
//   throw reason; // 这会导致测试失败
// });

// 可选：抑制某些模块在测试中的预期警告（如弃用警告）
// const originalWarn = console.warn;
// console.warn = (...args) => {
// 过滤掉你不想看到的特定警告信息
//   if (args[0] && args[0].includes('某些已知的、无害的警告信息')) {
//     return;
//   }
//   originalWarn(...args);
// };

// ========== 3. 全局测试辅助工具 (可选) ==========
// 3.1 增加所有测试的默认超时时间（毫秒）
// 如果某些异步测试较慢，可以在这里统一调整
// jest.setTimeout(10000); // 10秒

// 3.2 定义全局的模拟函数或数据（谨慎使用）
// global.mockUser = { id: 1, name: 'Test User' };

// 3.3 如果你使用了如 `node-fetch`，可以在这里配置全局模拟
// global.fetch = jest.fn();

// ========== 4. 数据库/外部服务模拟 (为1.5版本预留) ==========
// 4.1 在测试开始前连接到测试数据库（示例）
// let mongoose;
// beforeAll(async () => {
//   mongoose = await connectToTestDB();
// });
// 注意：真正的 `beforeAll` 不能写在这里！这只是一个注释示例。
// 正确的做法是将数据库生命周期管理写在单独的测试文件或使用Jest的 `globalSetup`。

// 4.2 在测试结束后清理数据（示例）
// afterAll(async () => {
//   await mongoose.connection.close();
// });

// ========== 5. 自定义匹配器或扩展期望 (高级) ==========
// 例如，添加一个用于检查对象是否包含特定结构的匹配器
// expect.extend({
//   toBeWithinRange(received, floor, ceiling) {
//     const pass = received >= floor && received <= ceiling;
//     if (pass) {
//       return {
//         message: () =>
//           `expected ${received} not to be within range ${floor} - ${ceiling}`,
//         pass: true,
//       };
//     } else {
//       return {
//         message: () =>
//           `expected ${received} to be within range ${floor} - ${ceiling}`,
//         pass: false,
//       };
//     }
//   },
// });

// ========== 6. 其他测试设置 (可选) ==========
// 6.1 设置测试覆盖率（示例）
// jest.useFakeTimers();    // 模拟时间 （可选）
// jest.useFakeTimers({ legacyFakeTimers: true });
