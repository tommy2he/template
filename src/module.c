/**
 * @file module.c
 * @brief 模块函数实现
 */

#include "module.h"
#include <float.h>

double calculate_average(const double values[], int count) {
    if (count <= 0)
        return 0.0;

    double sum = 0.0;
    for (int i = 0; i < count; i++) {
        sum += values[i];
    }
    return sum / count;
}

double find_max(const double values[], int count) {
    if (count <= 0)
        return 0.0;

    double max_value = values[0];
    for (int i = 1; i < count; i++) {
        if (values[i] > max_value) {
            max_value = values[i];
        }
    }
    return max_value;
}

double find_min(const double values[], int count) {
    if (count <= 0)
        return 0.0;

    double min_value = values[0];
    for (int i = 1; i < count; i++) {
        if (values[i] < min_value) {
            min_value = values[i];
        }
    }
    return min_value;
}
