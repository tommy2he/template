/**
 * @file module.h
 * @brief 模块函数声明
 */

#ifndef MODULE_H
#define MODULE_H

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief 计算平均值
 * @param values 双精度浮点数数组
 * @param count 数组元素数量
 * @return 平均值
 */
double calculate_average(const double values[], int count);

/**
 * @brief 查找最大值
 * @param values 双精度浮点数数组
 * @param count 数组元素数量
 * @return 最大值
 */
double find_max(const double values[], int count);

/**
 * @brief 查找最小值
 * @param values 双精度浮点数数组
 * @param count 数组元素数量
 * @return 最小值
 */
double find_min(const double values[], int count);

#ifdef __cplusplus
}
#endif

#endif // MODULE_H
