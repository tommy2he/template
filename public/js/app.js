// 公共配置
const API_BASE_URL = window.location.origin;

// 统一的API请求函数
async function makeAPIRequest(method, endpoint, body = null) {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Request-Source': 'frontend-app',
    'X-Request-Timestamp': new Date().toISOString(),
  };

  const options = {
    method: method,
    headers: headers,
  };

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options.body = JSON.stringify(body);
  }

  return await fetch(endpoint, options);
}

// 初始化应用
document.addEventListener('DOMContentLoaded', function () {
  console.log('🚀 前端应用已加载');
  initApp();
});

function initApp() {
  // 测试服务器连接
  checkServerConnection();

  // 绑定事件监听器
  bindEventListeners();

  console.log('✅ 应用初始化完成');
}

// 检查服务器连接
async function checkServerConnection() {
  try {
    const response = await makeAPIRequest('GET', '/health');
    const data = await response.json();
    console.log('✅ 服务器连接正常:', data);
    updateConnectionStatus('connected');
  } catch (error) {
    console.error('❌ 服务器连接失败:', error);
    updateConnectionStatus('disconnected');
  }
}

// 更新连接状态显示
function updateConnectionStatus(status) {
  const statusElement = document.getElementById('serverStatus');
  const indicator = document.querySelector('.status-indicator');

  if (status === 'connected') {
    statusElement.textContent = '已连接';
    statusElement.style.color = '#10b981';
    indicator.style.backgroundColor = '#10b981';
    indicator.style.boxShadow = '0 0 10px #10b981';
  } else {
    statusElement.textContent = '连接失败';
    statusElement.style.color = '#ef4444';
    indicator.style.backgroundColor = '#ef4444';
  }
}

// 绑定事件监听器
function bindEventListeners() {
  // 为所有测试按钮绑定点击事件
  document.querySelectorAll('.test-endpoint').forEach(btn => {
    btn.addEventListener('click', function () {
      const endpoint = this.dataset.endpoint;
      testAPI(endpoint);
    });
  });

  // 测试所有按钮
  const testAllBtn = document.getElementById('testAll');
  if (testAllBtn) {
    testAllBtn.addEventListener('click', testAllAPIs);
  }

  // 清空控制台按钮
  const clearConsoleBtn = document.getElementById('clearConsole');
  if (clearConsoleBtn) {
    clearConsoleBtn.addEventListener('click', clearConsole);
  }

  console.log('✅ 事件监听器已绑定');
}

// 测试单个API端点
async function testAPI(endpoint) {
  console.log(`📤 请求: GET ${endpoint}`);

  try {
    const response = await makeAPIRequest('GET', endpoint);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    console.log(`📥 响应:`, data);
    displayResponse({
      endpoint,
      method: 'GET',
      status: response.status,
      timestamp: new Date().toISOString(),
      data: data,
    });
  } catch (error) {
    console.error('❌ 请求失败:', error);
    displayResponse({
      endpoint,
      error: error.name,
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

// 测试所有API端点
async function testAllAPIs() {
  console.log('🔍 开始测试所有API端点');

  const endpoints = ['/', '/health', '/api/info', '/api/example'];
  const results = [];

  for (const endpoint of endpoints) {
    try {
      // 使用 makeAPIRequest 而不是原始的 fetch
      const response = await makeAPIRequest('GET', endpoint);
      const data = await response.json();
      results.push({
        endpoint,
        status: response.status,
        success: response.ok,
        data: data,
      });
      console.log(`✅ ${endpoint}: 成功`);
    } catch (error) {
      results.push({
        endpoint,
        success: false,
        error: error.message,
      });
      console.log(`❌ ${endpoint}: 失败 - ${error.message}`);
    }

    // 延迟一下，避免请求太快
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  displayResponse({
    title: '批量测试结果',
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      success: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
    },
    results: results,
  });

  console.log('✅ 所有API端点测试完成');
}

// 显示响应结果
function displayResponse(data) {
  const responseDiv = document.getElementById('response');

  // 创建格式化的JSON字符串
  let formattedJson;
  try {
    formattedJson = JSON.stringify(data, null, 2);
  } catch (e) {
    formattedJson = `无法格式化响应: ${e.message}\n原始数据: ${data}`;
  }

  // 创建响应显示
  responseDiv.innerHTML = `
        <div style="margin-bottom: 1rem; color: #94a3b8; font-size: 0.9rem;">
            <span>🕐 ${new Date().toLocaleTimeString()}</span>
            ${data.endpoint ? `<span style="margin-left: 1rem;">${data.endpoint}</span>` : ''}
            ${data.status ? `<span style="margin-left: 1rem; color: ${data.status === 200 ? '#10b981' : '#ef4444'}">${data.status}</span>` : ''}
        </div>
        <pre style="margin: 0;">${formattedJson}</pre>
    `;

  // 自动滚动到底部
  responseDiv.scrollTop = responseDiv.scrollHeight;
}

// 清空控制台
function clearConsole() {
  const responseDiv = document.getElementById('response');
  responseDiv.innerHTML = '<p>控制台已清空。点击按钮测试API。</p>';
  console.clear();
  console.log('🧹 控制台已清空');
}
