// check-project.js - 项目验证脚本（用于模板验证）
// 此脚本仅用于验证项目完整性，不会修改任何文件
// 运行：node check-project.js

const { execSync } = require('child_process');
const fs = require('fs');
// const path = require('path');

console.log('🧪 Node.js模板项目最终验证\n');

// 1. 关键文件检查
const criticalFiles = [
  'src/app.js',
  'src/server.js',
  'src/utils/helpers.js',
  'public/index.html',
  'routes/index.js',
  'package.json',
  '.vscode/settings.json',
  '.vscode/launch.json',
  'jest.config.js',
];

console.log('📁 关键文件检查:');
criticalFiles.forEach(file => {
  const exists = fs.existsSync(file);
  console.log(`${exists ? '✅' : '❌'} ${file}`);
});

// 2. 运行测试
console.log('\n🧪 测试运行:');
try {
  execSync('npm test', { stdio: 'inherit' });
  console.log('✅ 所有测试通过');
} catch (error) {
  console.log('❌ 测试失败');
  process.exit(1);
}

// 3. 启动服务器测试（短暂运行）
console.log('\n🚀 服务器启动测试:');
try {
  const app = require('./src/app');
  const server = app.listen(3002, () => {
    console.log('✅ 服务器可正常启动');
    server.close();
  });
} catch (error) {
  console.log('❌ 服务器启动失败:', error.message);
}

console.log('\n' + '='.repeat(50));
console.log('🎉 Node.js模板项目验证完成！');
console.log('项目已准备好作为模板使用。');
console.log('='.repeat(50));
