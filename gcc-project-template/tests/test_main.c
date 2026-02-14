/**
 * @file test_main.c
 * @brief 主测试文件
 */

#include "../include/module.h"
#include "../include/utils.h"
#include <assert.h>
#include <stdio.h>

void test_add() {
    printf("测试 add()... ");
    assert(add(2, 3) == 5);
    assert(add(-5, 10) == 5);
    assert(add(0, 0) == 0);
    printf("✅ 通过\n");
}

void test_multiply() {
    printf("测试 multiply()... ");
    assert(multiply(2, 3) == 6);
    assert(multiply(-5, 10) == -50);
    assert(multiply(0, 5) == 0);
    printf("✅ 通过\n");
}

void test_factorial() {
    printf("测试 factorial()... ");
    assert(factorial(0) == 1);
    assert(factorial(1) == 1);
    assert(factorial(5) == 120);
    printf("✅ 通过\n");
}

void test_calculate_average() {
    printf("测试 calculate_average()... ");
    double values[] = {1.0, 2.0, 3.0, 4.0, 5.0};
    assert(calculate_average(values, 5) == 3.0);
    printf("✅ 通过\n");
}

int main() {
    printf("🚀 开始运行测试...\n\n");

    test_add();
    test_multiply();
    test_factorial();
    test_calculate_average();

    printf("\n🎉 所有测试通过！\n");
    return 0;
}
