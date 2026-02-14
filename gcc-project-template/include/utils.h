/**
 * @file utils.h
 * @brief 工具函数声明
 */

#ifndef UTILS_H
#define UTILS_H

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief 打印程序信息
 * @param program_name 程序名称
 */
void print_program_info(const char *program_name);

/**
 * @brief 两个整数相加
 * @param a 第一个整数
 * @param b 第二个整数
 * @return 和
 */
int add(int a, int b);

/**
 * @brief 两个整数相乘
 * @param a 第一个整数
 * @param b 第二个整数
 * @return 积
 */
int multiply(int a, int b);

/**
 * @brief 计算阶乘
 * @param n 非负整数
 * @return n的阶乘
 */
int factorial(int n);

/**
 * @brief 打印数组
 * @param arr 整型数组
 * @param size 数组大小
 */
void print_array(int arr[], int size);

#ifdef __cplusplus
}
#endif

#endif // UTILS_H
