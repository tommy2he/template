#!/usr/bin/env node

const http = require('http');
const path = require('path');
const fs = require('fs');

console.log('🔍 测试 Swagger UI 配置...');

const options = {
  hostname: 'localhost',
  port: 3300,
  path: '/api-docs',
  method: 'GET',
  headers: {
    'User-Agent': 'Swagger-Test-Script',
  },
};

console.log(
  `🌐 访问: http://${options.hostname}:${options.port}${options.path}`,
);

const req = http.request(options, (res) => {
  console.log(`📊 状态码: ${res.statusCode}`);
  console.log(`📋 响应头:`, res.headers);

  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    // 检查是否是HTML响应
    if (
      res.headers['content-type'] &&
      res.headers['content-type'].includes('text/html')
    ) {
      console.log('✅ Swagger UI 返回了HTML页面');

      // 检查HTML中是否包含Swagger UI的关键元素
      if (data.includes('swagger-ui') || data.includes('Swagger')) {
        console.log('✅ HTML中包含Swagger UI元素');

        // 保存HTML文件以便查看
        const reportDir = path.join(__dirname, '../../reports');
        if (!fs.existsSync(reportDir)) {
          fs.mkdirSync(reportDir, { recursive: true });
        }

        const htmlPath = path.join(reportDir, 'swagger-ui-test.html');
        fs.writeFileSync(htmlPath, data);
        console.log(`📄 HTML已保存到: ${htmlPath}`);
      } else {
        console.log('❌ HTML中未找到Swagger UI元素');
        console.log('HTML前500字符:', data.substring(0, 500));
      }
    } else {
      console.log('❌ 响应不是HTML类型');
      console.log('响应内容类型:', res.headers['content-type']);
      console.log('响应前200字符:', data.substring(0, 200));
    }
  });
});

req.on('error', (error) => {
  console.error('❌ 请求出错:', error.message);

  // 检查服务器是否运行
  const checkServer = http.request(
    {
      hostname: 'localhost',
      port: 3300,
      path: '/',
      method: 'GET',
    },
    (res) => {
      console.log(`服务器响应状态: ${res.statusCode}`);
    },
  );

  checkServer.on('error', (err) => {
    console.error('❌ 服务器似乎未运行，请先启动应用');
    console.log('运行命令: npm run dev');
  });

  checkServer.end();
});

req.end();

// 同时测试 swagger.json
console.log('\n🔍 测试 swagger.json...');
const swaggerJsonOptions = {
  hostname: 'localhost',
  port: 3300,
  path: '/swagger.json',
  method: 'GET',
};

const swaggerReq = http.request(swaggerJsonOptions, (res) => {
  console.log(`📊 swagger.json 状态码: ${res.statusCode}`);

  let jsonData = '';
  res.on('data', (chunk) => {
    jsonData += chunk;
  });

  res.on('end', () => {
    try {
      const parsed = JSON.parse(jsonData);
      console.log('✅ swagger.json 是有效的JSON');
      console.log(`📋 文档标题: ${parsed.info?.title || '未找到'}`);
      console.log(`📋 API版本: ${parsed.info?.version || '未找到'}`);
      console.log(`📋 端点数量: ${Object.keys(parsed.paths || {}).length}`);
    } catch (error) {
      console.log('❌ swagger.json 不是有效的JSON');
      console.log('响应内容:', jsonData.substring(0, 200));
    }
  });
});

swaggerReq.on('error', (error) => {
  console.error('❌ 请求 swagger.json 出错:', error.message);
});

swaggerReq.end();
