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
