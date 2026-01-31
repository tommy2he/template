#!/bin/bash

echo "🔄 清理旧构建..."
rm -rf build

echo "🔨 开始构建..."
node-gyp configure build

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 构建成功！"
    echo ""
    echo "🚀 运行程序..."
    echo "========================================"
    node index.js
else
    echo ""
    echo "❌ 构建失败"
    exit 1
fi