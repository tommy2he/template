#!/bin/bash
echo "=== 逐步添加测试 ==="

# 1. 从最简单的开始
echo "1. 纯ASCII版本..."
cat > src/main.c.step1 << 'STEP1_EOF'
#include <stdio.h>
int main() {
    printf("Hello World\n");
    return 0;
}
STEP1_EOF
cp src/main.c.step1 src/main.c
make clean && make 2>&1 | grep -E "(编译|错误|成功)" && echo "✅ 步骤1成功" || echo "❌ 步骤1失败"

# 2. 添加基本结构
echo -e "\n2. 添加项目结构..."
cat > src/main.c.step2 << 'STEP2_EOF'
#include "module.h"
#include "utils.h"
#include <stdio.h>
#include <stdlib.h>

int main(int argc, char *argv[]) {
    print_program_info("C Project Template");
    return EXIT_SUCCESS;
}
STEP2_EOF
cp src/main.c.step2 src/main.c
make clean && make 2>&1 | grep -E "(编译|错误|成功)" && echo "✅ 步骤2成功" || echo "❌ 步骤2失败"

# 3. 添加英文注释和输出
echo -e "\n3. 添加英文输出..."
cat > src/main.c.step3 << 'STEP3_EOF'
#include "module.h"
#include "utils.h"
#include <stdio.h>
#include <stdlib.h>

int main(int argc, char *argv[]) {
    print_program_info("C Project Template");
    
    printf("\n=== Tool Functions ===\n");
    int a = 10, b = 25;
    printf("add(%d, %d) = %d\n", a, b, add(a, b));
    
    printf("\n[OK] Done!\n");
    return EXIT_SUCCESS;
}
STEP3_EOF
cp src/main.c.step3 src/main.c
make clean && make 2>&1 | grep -E "(编译|错误|成功)" && echo "✅ 步骤3成功" || echo "❌ 步骤3失败"

# 4. 添加一个中文字符
echo -e "\n4. 添加一个中文字符..."
cat > src/main.c.step4 << 'STEP4_EOF'
#include "module.h"
#include "utils.h"
#include <stdio.h>
#include <stdlib.h>

int main(int argc, char *argv[]) {
    print_program_info("C Project Template");
    
    printf("\n=== 工具函数 ===\n");
    int a = 10, b = 25;
    printf("add(%d, %d) = %d\n", a, b, add(a, b));
    
    printf("\n完成！\n");
    return EXIT_SUCCESS;
}
STEP4_EOF
cp src/main.c.step4 src/main.c
make clean && make 2>&1 | grep -E "(编译|错误|成功)" && echo "✅ 步骤4成功" || echo "❌ 步骤4失败"

# 5. 添加更多中文
echo -e "\n5. 添加更多中文..."
cat > src/main.c.step5 << 'STEP5_EOF'
#include "module.h"
#include "utils.h"
#include <stdio.h>
#include <stdlib.h>

int main(int argc, char *argv[]) {
    print_program_info("C Project Template");
    
    printf("\n=== 工具函数演示 ===\n");
    int a = 10, b = 25;
    printf("add(%d, %d) = %d\n", a, b, add(a, b));
    
    printf("\n✅ 程序执行完成！\n");
    return EXIT_SUCCESS;
}
STEP5_EOF
cp src/main.c.step5 src/main.c
make clean && make 2>&1 | grep -E "(编译|错误|成功)" && echo "✅ 步骤5成功" || echo "❌ 步骤5失败"

# 清理
rm -f src/main.c.step*
