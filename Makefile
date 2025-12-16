# Makefile for C Project Template
# Author: [Your Name]
# Date: 2024

# ============================================================================
# 配置
# ============================================================================

# 编译器
CC = gcc

# 编译器标志
CFLAGS = -g -Wall -Wextra -pedantic -std=c17
CFLAGS_RELEASE = -O2 -DNDEBUG -std=c17
CFLAGS_DEBUG = -g -O0 -DDEBUG -std=c17

# 包含路径
INCLUDES = -I./include

# 源文件目录
SRC_DIR = src
BUILD_DIR = build
TEST_DIR = tests
LIB_DIR = lib

# 源文件
SRC_FILES = $(wildcard $(SRC_DIR)/*.c)
OBJ_FILES = $(patsubst $(SRC_DIR)/%.c, $(BUILD_DIR)/%.o, $(SRC_FILES))

# 测试源文件
TEST_SRC_FILES = $(wildcard $(TEST_DIR)/*.c)
TEST_OBJ_FILES = $(patsubst $(TEST_DIR)/%.c, $(BUILD_DIR)/%.o, $(TEST_SRC_FILES))

# 目标可执行文件
TARGET = $(BUILD_DIR)/$(shell basename $(CURDIR)).exe
TEST_TARGET = $(BUILD_DIR)/test_runner.exe

# ============================================================================
# 构建目标
# ============================================================================

# 默认构建调试版本
all: debug

# 调试版本
debug: CFLAGS = $(CFLAGS_DEBUG)
debug: $(TARGET)

# 发布版本
release: CFLAGS = $(CFLAGS_RELEASE)
release: $(TARGET)

# 主目标文件
$(TARGET): $(OBJ_FILES)
	@echo "🔗 链接目标文件: $@"
	@mkdir -p $(BUILD_DIR)
	$(CC) $(CFLAGS) $(INCLUDES) -o $@ $^

# 编译源文件
$(BUILD_DIR)/%.o: $(SRC_DIR)/%.c
	@echo "🔨 编译: $<"
	@mkdir -p $(BUILD_DIR)
	$(CC) $(CFLAGS) $(INCLUDES) -c $< -o $@

$(BUILD_DIR)/%.o: $(TEST_DIR)/%.c
	@echo "🔨 编译测试文件: $<"
	@mkdir -p $(BUILD_DIR)
	$(CC) $(CFLAGS) $(INCLUDES) -c $< -o $@

# ============================================================================
# 测试
# ============================================================================

# 构建测试
test: $(TEST_TARGET)
	@echo "🧪 运行测试..."
	@./$(TEST_TARGET)

# 测试目标文件
$(TEST_TARGET): $(filter-out $(BUILD_DIR)/main.o, $(OBJ_FILES)) $(TEST_OBJ_FILES)
	@echo "🔗 链接测试目标文件: $@"
	$(CC) $(CFLAGS) $(INCLUDES) -o $@ $^

# ============================================================================
# 清理
# ============================================================================

clean:
	@echo "🧹 清理构建文件..."
	@rm -rf $(BUILD_DIR)/*.o $(BUILD_DIR)/*.exe 2>/dev/null || true

distclean: clean
	@echo "🧹 深度清理..."
	@rm -rf $(BUILD_DIR) 2>/dev/null || true

# ============================================================================
# 运行
# ============================================================================

run: $(TARGET)
	@echo "▶️  运行程序: $(TARGET)"
	@./$(TARGET)

run_test: test

# ============================================================================
# 调试
# ============================================================================

gdb: debug
	@echo "🐛 启动GDB调试..."
	gdb $(TARGET)

valgrind: debug
	@echo "🔍 使用Valgrind检查内存泄漏..."
	valgrind --leak-check=full --show-leak-kinds=all ./$(TARGET)

# ============================================================================
# 静态分析
# ============================================================================

lint:
	@echo "📋 运行静态分析..."
	cppcheck --enable=all --suppress=missingIncludeSystem $(SRC_DIR) $(INCLUDES)

# ============================================================================
# 文档生成
# ============================================================================

docs:
	@echo "📚 生成文档..."
	@mkdir -p docs/html
	doxygen Doxyfile 2>/dev/null || echo "请先配置Doxyfile"

# ============================================================================
# 帮助
# ============================================================================

help:
	@echo "可用命令:"
	@echo "  make             - 构建调试版本（默认）"
	@echo "  make debug       - 构建调试版本"
	@echo "  make release     - 构建发布版本"
	@echo "  make run         - 编译并运行程序"
	@echo "  make test        - 编译并运行测试"
	@echo "  make clean       - 清理构建文件"
	@echo "  make distclean   - 深度清理"
	@echo "  make gdb         - 编译并启动GDB调试"
	@echo "  make valgrind    - 编译并运行Valgrind检查"
	@echo "  make lint        - 运行静态代码分析"
	@echo "  make docs        - 生成文档"
	@echo "  make help        - 显示此帮助信息"

.PHONY: all debug release clean distclean run run_test test gdb valgrind lint docs help
