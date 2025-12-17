#!/bin/bash
echo "=== 修复源文件编码问题 ==="

# 1. 备份所有源文件
echo "1. 备份源文件..."
find src -name "*.c" -exec cp {} {}.backup \;

# 2. 检查文件编码
echo -e "\n2. 检查文件编码..."
for file in src/*.c; do
    echo "检查: $file"
    # 检查文件是否包含非法字节序列
    if grep -q "Illegal byte sequence" <(gcc -finput-charset=UTF-8 -c "$file" -o /dev/null 2>&1); then
        echo "  ❌ 包含非法字节序列"
        # 尝试修复：移除BOM和非ASCII字符
        sed -i 's/[^[:print:]\t]//g' "$file"
        sed -i '1s/^\xEF\xBB\xBF//' "$file"
        echo "  已尝试修复"
    else
        echo "  ✅ 编码正常"
    fi
done

# 3. 修复已知问题
echo -e "\n3. 修复已知问题..."

# main.c: 修复第37行
if [ -f "src/main.c" ]; then
    echo "修复 src/main.c..."
    sed -i '37s/.*/    printf("\\n✅ 程序执行完成！\\n");/' src/main.c
fi

# utils.c: 修复格式警告
if [ -f "src/utils.c" ]; then
    echo "修复 src/utils.c 格式警告..."
    sed -i 's/printf("  C 标准: C%d\\n", __STDC_VERSION__ \/ 100);/printf("  C 标准: C%ld\\n", __STDC_VERSION__ \/ 100);/' src/utils.c
fi

echo -e "\n✅ 修复完成"
