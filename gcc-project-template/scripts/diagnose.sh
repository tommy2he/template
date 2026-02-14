#!/bin/bash
echo "=== 诊断信息 ==="

# 1. 检查Makefile
echo -e "\n1. Makefile内容："
head -20 Makefile
echo "..."
tail -10 Makefile

# 2. 检查CFLAGS
echo -e "\n2. CFLAGS设置："
grep "CFLAGS :=" Makefile

# 3. 检查源文件
echo -e "\n3. 源文件编码："
for file in src/*.c; do
    echo -n "$file: "
    file "$file" | cut -d: -f2-
done

# 4. 检查问题行
echo -e "\n4. 检查问题行："
for file in src/*.c; do
    echo "检查 $file 中的非法字符："
    # 检查非ASCII字符
    grep -n -P "[\x80-\xFF]" "$file" | head -5
done

# 5. 编译测试
echo -e "\n5. 编译测试："
gcc -finput-charset=UTF-8 -fexec-charset=GBK -c src/main.c -o /dev/null 2>&1 | head -20
