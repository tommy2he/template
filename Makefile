# ======================================================
# C Project Makefile - 完美版 for Windows/MSYS2
# 作者: tommy
# 日期: 2025-12-17
# ======================================================

# ======================================================
# 1. 编译器配置
# ======================================================

# 编译器
CC := gcc

# 编码配置（关键！）
# - 源代码：UTF-8
# - 输出：GBK（适配Windows控制台）
# - 临时目录：项目根目录下的temp/gcc
CFLAGS := -g -Wall -Wextra -pedantic -std=c17 \
          -I./include \
          -finput-charset=UTF-8 \
          -fexec-charset=GBK

# ======================================================
# 2. 目录配置
# ======================================================

# 源文件目录
SRC_DIR := src
# 头文件目录
INC_DIR := include
# 构建输出目录
BUILD_DIR := build
# 临时目录（GCC编译时使用）
TEMP_DIR := ./temp/gcc

# 确保临时目录环境变量
export TMP := $(abspath $(TEMP_DIR))
export TEMP := $(abspath $(TEMP_DIR))
export TMPDIR := $(abspath $(TEMP_DIR))

# ======================================================
# 3. 文件配置
# ======================================================

# 自动查找所有.c文件
SRCS := $(wildcard $(SRC_DIR)/*.c)
# 生成对应的.o文件路径
OBJS := $(patsubst $(SRC_DIR)/%.c, $(BUILD_DIR)/%.o, $(SRCS))
# 最终目标可执行文件
TARGET := $(BUILD_DIR)/$(notdir $(CURDIR)).exe

# ======================================================
# 4. 伪目标声明
# ======================================================

.PHONY: all clean clean_all clean_temp run debug release help env setup

# ======================================================
# 5. 主要构建规则
# ======================================================

# 默认目标 - 必须是第一个目标！
all: setup $(TARGET)
	@echo "✅ 构建完成: $(TARGET)"

# 调试版本（带调试符号）
debug: CFLAGS += -DDEBUG -O0
debug: all

# 发布版本（优化）
release: CFLAGS += -DNDEBUG -O2
release: all

# 链接目标文件
$(TARGET): $(OBJS)
	@echo "🔗 链接目标文件: $@"
	@mkdir -p $(BUILD_DIR)
	$(CC) $(CFLAGS) -o $@ $^

# 编译规则 - 使用order-only依赖确保临时目录存在
$(BUILD_DIR)/%.o: $(SRC_DIR)/%.c | setup
	@echo "🔨 编译: $<"
	@mkdir -p $(BUILD_DIR)
	$(CC) $(CFLAGS) -c $< -o $@

# ======================================================
# 6. 环境设置规则
# ======================================================

# 设置环境（创建必要目录） - order-only依赖
setup:
	@mkdir -p $(BUILD_DIR) $(TEMP_DIR)

# ======================================================
# 7. 清理规则
# ======================================================

# 清理构建文件
clean:
	@echo "🧹 清理构建文件..."
	@rm -rf $(BUILD_DIR)/*.o $(BUILD_DIR)/*.exe 2>/dev/null || true

# 清理临时文件
clean_temp:
	@echo "🧹 清理临时文件..."
	@rm -rf $(TEMP_DIR)/* 2>/dev/null || true

# 清理所有（构建文件+临时文件）
clean_all: clean clean_temp
	@echo "🧹 清理所有生成文件..."

# ======================================================
# 8. 运行和调试规则
# ======================================================

# 运行程序
run: $(TARGET)
	@echo "🚀 运行程序..."
	@./$(TARGET)

# 调试程序
debug_run: debug
	@echo "🐛 启动调试..."
	@gdb $(TARGET)

# ======================================================
# 9. 工具规则
# ======================================================

# 显示环境信息
env:
	@echo "🌍 环境信息:"
	@echo "  项目根目录: $(CURDIR)"
	@echo "  源文件目录: $(SRC_DIR)"
	@echo "  头文件目录: $(INC_DIR)"
	@echo "  构建目录: $(BUILD_DIR)"
	@echo "  临时目录: $(TEMP_DIR)"
	@echo "  编译器: $(CC)"
	@echo "  编译选项: $(CFLAGS)"
	@echo "  源文件: $(SRCS)"
	@echo "  目标文件: $(OBJS)"
	@echo "  最终目标: $(TARGET)"
	@echo "  临时环境变量:"
	@echo "    TMP: $$TMP"
	@echo "    TEMP: $$TEMP"
	@echo "    TMPDIR: $$TMPDIR"

# 显示帮助信息
help:
	@echo "📖 可用命令:"
	@echo "  make              - 构建项目（默认）"
	@echo "  make all          - 构建项目"
	@echo "  make debug        - 构建调试版本"
	@echo "  make release      - 构建发布版本"
	@echo "  make clean        - 清理构建文件"
	@echo "  make clean_temp   - 清理临时文件"
	@echo "  make clean_all    - 清理所有生成文件"
	@echo "  make run          - 编译并运行程序"
	@echo "  make debug_run    - 编译并启动调试"
	@echo "  make env          - 显示环境信息"
	@echo "  make help         - 显示此帮助信息"
	@echo ""
	@echo "📝 项目配置:"
	@echo "  源文件编码: UTF-8"
	@echo "  输出编码: GBK（适配Windows控制台）"
	@echo "  临时文件: $(TEMP_DIR)"
	@echo "  构建输出: $(BUILD_DIR)/"

# ======================================================
# 10. 快速测试规则
# ======================================================

# 快速测试：清理->构建->运行
test: clean_all all run
	@echo "🎉 快速测试完成！"

# 验证构建系统
verify:
	@echo "🔍 验证构建系统..."
	@echo "1. 检查编译器..."
	@$(CC) --version 2>&1 | head -1
	@echo "2. 检查源文件..."
	@if [ -n "$(SRCS)" ]; then \
		echo "  找到 $(words $(SRCS)) 个源文件"; \
		for f in $(SRCS); do echo "    - $$f"; done; \
	else \
		echo "  ⚠️  未找到源文件，请确认 $(SRC_DIR)/ 目录下有.c文件"; \
	fi
	@echo "3. 检查目录结构..."
	@mkdir -p $(BUILD_DIR) $(TEMP_DIR)
	@echo "  ✅ 目录结构正常"
	@echo "✅ 验证完成"