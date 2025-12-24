#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// 创建报告目录结构
const reportsStructure = [
  'reports/unit/coverage',
  'reports/integration',
  'reports/performance',
  'reports/e2e',
];

console.log('📁 设置报告目录结构...');

reportsStructure.forEach((dir) => {
  const fullPath = path.join(__dirname, '..', dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`✅ 创建目录: ${dir}`);
  } else {
    console.log(`📁 目录已存在: ${dir}`);
  }
});

// 创建一个说明文件
const readmeContent = `# 测试报告目录结构

## 📁 目录说明

- \`reports/unit/\` - 单元测试报告
  - \`test-report.html\` - Jest HTML报告
  - \`coverage/\` - 测试覆盖率报告
- \`reports/integration/\` - 集成测试报告
- \`reports/performance/\` - 性能测试报告
  - \`performance-report.html\` - 基准测试报告
  - \`load-test-report.html\` - 负载测试报告
  - \`stress-report.html\` - 压力测试报告
- \`reports/e2e/\` - 端到端测试报告

## 🚀 使用方法

1. 运行单元测试和生成报告:
   \`\`\`bash
   npm test
   # 或者
   npm run test:coverage
   \`\`\`

2. 查看单元测试报告:
   - HTML报告: \`reports/unit/test-report.html\`
   - 覆盖率报告: \`reports/unit/coverage/index.html\`

3. 运行性能测试:
   \`\`\`bash
   npm run benchmark      # 基准测试
   npm run load:test      # 负载测试
   npm run stress:test    # 压力测试
   \`\`\`

4. 查看性能报告:
   - 基准测试: \`reports/performance/performance-report.html\`
   - 负载测试: \`reports/performance/load-test-report.html\`

## 📊 报告生成时间
${new Date().toISOString()}
`;

const readmePath = path.join(__dirname, '..', 'reports', 'README.md');
fs.writeFileSync(readmePath, readmeContent);
console.log(`📄 创建说明文件: ${readmePath}`);

console.log('🎉 报告目录结构设置完成！');
