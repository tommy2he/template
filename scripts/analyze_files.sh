#!/bin/bash
echo "=== 文件差异分析 ==="

FILE1="src/main.c.backup"
FILE2="src/main.c"

# 1. 检查文件基本信息
echo "1. 文件基本信息:"
echo "文件1 ($FILE1):"
ls -la "$FILE1"
echo -n "  大小(字节): "; wc -c < "$FILE1"
echo "文件2 ($FILE2):"
ls -la "$FILE2"
echo -n "  大小(字节): "; wc -c < "$FILE2"

# 2. 检查文件类型和编码
echo -e "\n2. 文件类型和编码:"
echo "文件1:"
file "$FILE1"
echo -n "  前3个字节(十六进制): "; head -c3 "$FILE1" | od -An -tx1 | tr -d ' \n'
echo ""
echo "文件2:"
file "$FILE2"
echo -n "  前3个字节(十六进制): "; head -c3 "$FILE2" | od -An -tx1 | tr -d ' \n'
echo ""

# 3. 检查BOM标记
echo -e "\n3. BOM标记检查:"
echo -n "文件1是否有BOM: "
if head -c3 "$FILE1" | grep -q $'\xEF\xBB\xBF'; then
    echo "有 (EF BB BF)"
else
    echo "无"
fi
echo -n "文件2是否有BOM: "
if head -c3 "$FILE2" | grep -q $'\xEF\xBB\xBF'; then
    echo "有 (EF BB BF)"
else
    echo "无"
fi

# 4. 检查换行符类型
echo -e "\n4. 换行符检查:"
echo -n "文件1换行符: "
if grep -q $'\r' "$FILE1"; then
    echo "CRLF (Windows)"
else
    echo "LF (Unix)"
fi
echo -n "文件2换行符: "
if grep -q $'\r' "$FILE2"; then
    echo "CRLF (Windows)"
else
    echo "LF (Unix)"
fi

# 5. 显示文件内容（可见字符）
echo -e "\n5. 文件内容对比 (前10行):"
echo "文件1前10行:"
head -10 "$FILE1" | cat -A
echo -e "\n文件2前10行:"
head -10 "$FILE2" | cat -A

# 6. 检查特定行的十六进制
echo -e "\n6. '程序执行完成'行的十六进制对比:"
echo "在文件1中查找该行:"
LINE1=$(grep -n "程序执行完成" "$FILE1" 2>/dev/null || echo "未找到")
echo "  $LINE1"
if [ "$LINE1" != "未找到" ]; then
    LINENUM1=$(echo "$LINE1" | cut -d: -f1)
    echo "  行号: $LINENUM1"
    echo "  十六进制:"
    sed -n "${LINENUM1}p" "$FILE1" | od -x
fi

echo -e "\n在文件2中查找该行:"
LINE2=$(grep -n "程序执行完成" "$FILE2" 2>/dev/null || echo "未找到")
echo "  $LINE2"
if [ "$LINE2" != "未找到" ]; then
    LINENUM2=$(echo "$LINE2" | cut -d: -f1)
    echo "  行号: $LINENUM2"
    echo "  十六进制:"
    sed -n "${LINENUM2}p" "$FILE2" | od -x
fi

# 7. 检查文件结尾
echo -e "\n7. 文件结尾检查:"
echo -n "文件1最后10个字节: "; tail -c10 "$FILE1" | od -An -tx1 | tr -d '\n'
echo ""
echo -n "文件2最后10个字节: "; tail -c10 "$FILE2" | od -An -tx1 | tr -d '\n'
echo ""

# 8. 检查不可打印字符
echo -e "\n8. 不可打印字符检查:"
echo "文件1不可打印字符统计:"
cat -v "$FILE1" | grep -o '[[:cntrl:]]' | sort | uniq -c | while read count char; do
    printf "  字符 0x%02x (十进制 %d): %d次\n" "'$char" "'$char" "$count"
done

echo -e "\n文件2不可打印字符统计:"
cat -v "$FILE2" | grep -o '[[:cntrl:]]' | sort | uniq -c | while read count char; do
    printf "  字符 0x%02x (十进制 %d): %d次\n" "'$char" "'$char" "$count"
done

# 9. 使用diff查看差异
echo -e "\n9. 文件差异摘要:"
diff -u "$FILE1" "$FILE2" | head -30

echo -e "\n=== 分析完成 ==="
