#!/bin/bash

echo "🔧 安装 AST 检测工具依赖..."
cd scripts

# 检查是否已安装依赖
if [ ! -d "node_modules" ]; then
    echo "正在安装依赖..."
    npm install @babel/parser @babel/traverse glob
fi

echo "🚀 开始运行 AST 安全检查..."
node ast-safety-checker.js ../src

echo "✅ 检查完成！"
