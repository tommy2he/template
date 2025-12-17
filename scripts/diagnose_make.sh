#!/bin/bash
echo "=== Makefile 诊断 ==="

# 1. 检查 make 版本
echo "1. make 版本:"
make --version | head -1

# 2. 检查源文件是否存在
echo -e "\n2. 源文件检查:"
for file in src/main.c src/utils.c src/module.c; do
    if [ -f "$file" ]; then
        echo "  ✅ $file 存在"
    else
        echo "  ❌ $file 不存在"
    fi
done

# 3. 测试直接编译
echo -e "\n3. 直接编译测试:"
gcc -g -Wall -Wextra -pedantic -std=c17 -I./include src/main.c src/utils.c src/module.c -o build/test_direct.exe
if [ $? -eq 0 ]; then
    echo "  ✅ 直接编译成功"
    ./build/test_direct.exe && echo "  ✅ 程序运行成功"
else
    echo "  ❌ 直接编译失败"
fi

# 4. 测试模式规则匹配
echo -e "\n4. 模式规则测试:"
echo "  尝试: make build/main.o"
make build/main.o 2>&1 | head -20

# 5. 查看 Makefile 中的变量
echo -e "\n5. Makefile 变量检查:"
grep -n "SRCS\|OBJS\|TARGET\|BUILD_DIR" Makefile | head -20

# 6. 检查文件格式
echo -e "\n6. 文件格式检查:"
file Makefile src/main.c | grep -E "(CRLF|LF)"
