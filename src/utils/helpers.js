// src/utils/helpers.js
/**
 * 格式化时间戳为可读字符串
 * @param {number|string} timestamp - 时间戳
 * @returns {string} 格式化后的时间
 */
function formatTimestamp(timestamp = Date.now()) {
  const date = new Date(Number(timestamp));
  return date.toISOString().replace('T', ' ').split('.')[0];
}

/**
 * 生成唯一ID
 * @returns {string} 唯一ID
 */
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

module.exports = {
  formatTimestamp,
  generateId,
};
