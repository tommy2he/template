#!/bin/bash
echo "=== 重建源文件 ==="

# 备份原目录
echo "备份原文件..."
mkdir -p backup_$(date +%Y%m%d%H%M%S)
cp -r src include backup_$(date +%Y%m%d%H%M%S)/

# 重建main.c
echo "重建 main.c..."
cat > src/main.c << 'MAIN_EOF'
#include "module.h"
#include "utils.h"
#include <stdio.h>
#include <stdlib.h>

int main(int argc, char *argv[]) {
    // 打印程序信息
    print_program_info("C Project Template");

    // 演示工具函数
    printf("\n=== 工具函数演示 ===\n");
    int a = 10, b = 25;
    printf("add(%d, %d) = %d\n", a, b, add(a, b));
    printf("multiply(%d, %d) = %d\n", a, b, multiply(a, b));

    // 演示模块函数
    printf("\n=== 模块函数演示 ===\n");
    double values[] = {1.5, 2.5, 3.5, 4.5, 5.5};
    int count = sizeof(values) / sizeof(values[0]);
    printf("平均值: %.2f\n", calculate_average(values, count));
    printf("最大值: %.2f\n", find_max(values, count));

    // 演示命令行参数
    printf("\n=== 命令行参数 ===\n");
    printf("参数数量: %d\n", argc);
    for (int i = 0; i < argc; i++) {
        printf("参数 %d: %s\n", i, argv[i]);
    }

    printf("\n✅ 程序执行完成！\n");
    return EXIT_SUCCESS;
}
MAIN_EOF

# 重建utils.c
echo "重建 utils.c..."
cat > src/utils.c << 'UTILS_EOF'
#include <stdio.h>
#include "utils.h"

void print_program_info(const char* program_name) {
    printf("========================================\n");
    printf("  程序: %s\n", program_name);
    printf("  编译器: GCC %d.%d.%d\n", 
           __GNUC__, __GNUC_MINOR__, __GNUC_PATCHLEVEL__);
    printf("  C 标准: C%ld\n", __STDC_VERSION__ / 100);
    printf("  编译时间: %s %s\n", __DATE__, __TIME__);
    printf("========================================\n");
}

int add(int a, int b) {
    return a + b;
}

int multiply(int a, int b) {
    return a * b;
}

int factorial(int n) {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}

void print_array(int arr[], int size) {
    printf("[");
    for (int i = 0; i < size; i++) {
        printf("%d", arr[i]);
        if (i < size - 1) printf(", ");
    }
    printf("]\n");
}
UTILS_EOF

# 重建module.c
echo "重建 module.c..."
cat > src/module.c << 'MODULE_EOF'
#include <float.h>
#include "module.h"

double calculate_average(const double values[], int count) {
    if (count <= 0) return 0.0;
    
    double sum = 0.0;
    for (int i = 0; i < count; i++) {
        sum += values[i];
    }
    return sum / count;
}

double find_max(const double values[], int count) {
    if (count <= 0) return 0.0;
    
    double max_value = values[0];
    for (int i = 1; i < count; i++) {
        if (values[i] > max_value) {
            max_value = values[i];
        }
    }
    return max_value;
}

double find_min(const double values[], int count) {
    if (count <= 0) return 0.0;
    
    double min_value = values[0];
    for (int i = 1; i < count; i++) {
        if (values[i] < min_value) {
            min_value = values[i];
        }
    }
    return min_value;
}
MODULE_EOF

echo "✅ 源文件重建完成"
