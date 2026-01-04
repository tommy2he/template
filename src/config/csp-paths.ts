// src/config/csp-paths.ts
/**
 * CSP（内容安全策略）路径配置
 * 用于管理允许内联脚本和特殊CSP规则的页面
 */

// 开发环境允许内联脚本的页面路径
export const cspAllowInlineScriptPaths = {
  development: [
    '/', // 主页面
    '/index.html', // 主页
    '/ui.html', // 管理员界面
    '/simple-test.html', // 简单测试页面
    '/test.html', // 测试页面
    '/debug.html', // 调试页面
    '/direct-test.html', // 直接测试页面
    '/csp-test.html', // CSP测试页面
    '/check-headers.html', // 检查响应头页面
    '/test-minimal.html', // 最小测试页面
    '/alert.html', // 弹窗测试页面
  ],
  test: [
    // 测试环境允许内联脚本的页面
    '/',
    '/test.html',
  ],
  production: [
    // 生产环境通常不允许内联脚本
    // 如有需要，可以添加特定页面
  ],
};

// 需要 'unsafe-eval' 的页面（如 Swagger UI）
export const cspAllowEvalPaths = {
  development: [
    '/api-docs', // Swagger UI 主页面
    '/api-docs/', // Swagger UI 子路径
  ],
  test: ['/api-docs', '/api-docs/'],
  production: [
    // 生产环境通常不允许 eval
    // 如有需要，可以添加特定页面
  ],
};

// 允许外部资源的页面（如使用 CDN 的页面）
export const cspAllowExternalPaths = {
  development: [
    '/cpe/monitor', // CPE监控面板
  ],
  test: ['/cpe/monitor'],
  production: ['/cpe/monitor'],
};

// 获取页面应使用的 CSP 策略
export function getCSPForPath(env: string, path: string): string | null {
  // 检查是否需要允许 eval（Swagger UI 等）
  const allowEvalPaths =
    cspAllowEvalPaths[env as keyof typeof cspAllowEvalPaths] || [];
  if (allowEvalPaths.some((p) => path === p || path.startsWith(p))) {
    return getSwaggerUICSP();
  }

  // 检查是否需要允许外部资源
  const allowExternalPaths =
    cspAllowExternalPaths[env as keyof typeof cspAllowExternalPaths] || [];
  if (allowExternalPaths.some((p) => path === p || path.startsWith(p))) {
    return getExternalResourceCSP();
  }

  // 检查是否需要允许内联脚本
  const allowInlinePaths =
    cspAllowInlineScriptPaths[env as keyof typeof cspAllowInlineScriptPaths] ||
    [];
  if (allowInlinePaths.includes(path)) {
    return getInlineScriptCSP();
  }

  // 不需要特殊 CSP
  return null;
}

// Swagger UI 的 CSP 策略
function getSwaggerUICSP(): string {
  return (
    "default-src 'self'; " +
    "style-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net https://fonts.googleapis.com https://cdnjs.cloudflare.com; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
    "img-src 'self' data: https:; " +
    "font-src 'self' https://fonts.gstatic.com https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
    "connect-src 'self';"
  );
}

// 允许内联脚本的 CSP 策略
function getInlineScriptCSP(): string {
  return (
    "default-src 'self'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "script-src 'self' 'unsafe-inline'; " + // 关键：允许内联脚本
    "img-src 'self' data: https:; " +
    "connect-src 'self'; " +
    "font-src 'self'; " +
    "object-src 'none'; " +
    "media-src 'self'; " +
    "frame-src 'none';"
  );
}

// 允许外部资源的 CSP 策略
function getExternalResourceCSP(): string {
  return (
    "default-src 'self'; " +
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self'; " +
    "font-src 'self'; " +
    "object-src 'none'; " +
    "media-src 'self'; " +
    "frame-src 'none';"
  );
}

// 工具函数：检查路径是否需要特殊 CSP 处理
export function needsSpecialCSP(env: string, path: string): boolean {
  return getCSPForPath(env, path) !== null;
}
