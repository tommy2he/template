// 模拟 chalk 模块
const chalk = {
  green: (text) => `GREEN:${text}`,
  yellow: (text) => `YELLOW:${text}`,
  red: (text) => `RED:${text}`,
  // chalk 5.x 的默认导出方式
  default: {
    green: (text) => `GREEN:${text}`,
    yellow: (text) => `YELLOW:${text}`,
    red: (text) => `RED:${text}`,
  },
};

// 支持 CommonJS 和 ESM 两种导出方式
module.exports = chalk;
module.exports.default = chalk;
