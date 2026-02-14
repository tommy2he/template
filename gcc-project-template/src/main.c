#include "module.h"
#include "utils.h"
#include <stdio.h>
#include <stdlib.h>

int main(int argc, char *argv[]) {
    // 打印程序信息
    print_program_info("C Project Template");

    printf("\n 程序特殊符号测试\n");

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

    printf("\n程序执行完成！\n");
    return EXIT_SUCCESS;
}
