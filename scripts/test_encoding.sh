#!/bin/bash
echo "=== GCC 编码测试 ==="

# 测试1：不同编码选项
echo -e "\n1. 测试不同编码选项："
echo "创建测试文件..."
cat > test_utf8.c << 'C_EOF'
#include <stdio.h>
int main() { printf("中文测试: Hello 中文\n"); return 0; }
C_EOF

echo "编译选项测试："
echo "a) 无编码选项:"
gcc test_utf8.c -o test_no_encoding.exe 2>&1 | grep -i "warning"
./test_no_encoding.exe

echo -e "\nb) 有UTF-8编码选项:"
gcc -finput-charset=UTF-8 -fexec-charset=UTF-8 test_utf8.c -o test_utf8.exe 2>&1 | grep -i "warning"
./test_utf8.exe

# 测试2：检查文件编码
echo -e "\n2. 文件编码检查："
file test_utf8.c
echo -n "源文件BOM: "
head -c3 test_utf8.c | od -An -tx1 | tr -d ' \n'
echo " (EF BB BF = UTF-8 BOM)"

# 测试3：查看GCC默认编码
echo -e "\n3. GCC默认设置："
gcc -v 2>&1 | grep -i "default"
gcc -Q --help=target 2>&1 | grep -i "charset"

# 清理
rm -f test_*.c test_*.exe
