#####################################
### nodejs通过c语言插件调用c代码demo
#####################################
### 完整目录
#
cb-demo/                    # 项目根目录
├── binding.gyp            # node-gyp构建配置文件，定义如何编译C++插件
├── build/                 # node-gyp生成的构建目录
│   ├── Release/           # 编译输出目录（Release配置）
│   │   ├── input_wrap.exp  # 导出文件，用于动态链接库（DLL）的导出符号
│   │   ├── input_wrap.iobj  # MSVC增量编译的中间对象文件
│   │   ├── input_wrap.ipdb  # MSVC增量编译的程序数据库
│   │   ├── input_wrap.lib   # 静态库文件，包含导出符号
│   │   ├── input_wrap.node  # 编译好的Node.js C++插件（二进制模块）
│   │   ├── input_wrap.pdb   # 程序调试数据库，用于调试
│   │   └── obj/           # 编译过程中生成的中间文件目录
│   │       └── input_wrap/
│   │           ├── input_wrap.node.recipe  # 构建脚本的中间记录文件
│   │           ├── input_wrap.tlog/        # 跟踪日志目录，记录构建步骤
│   │           │   ├── CL.command.1.tlog   # 记录CL编译器命令
│   │           │   ├── CL.read.1.tlog      # 记录CL编译器读取的文件
│   │           │   ├── CL.write.1.tlog     # 记录CL编译器写入的文件
│   │           │   ├── input_wrap.lastbuildstate  # 记录最后一次构建的状态
│   │           │   ├── input_wrap.write.1u.tlog   # 记录构建过程中的写入操作
│   │           │   ├── link.command.1.tlog # 记录链接器命令
│   │           │   ├── link.read.1.tlog    # 记录链接器读取的文件
│   │           │   └── link.write.1.tlog   # 记录链接器写入的文件
│   │           ├── src/                    # 对应源码目录的中间文件
│   │           │   └── input_wrap.obj      # 由input_wrap.cc编译出的对象文件
│   │           └── win_delay_load_hook.obj  # Windows延迟加载钩子的对象文件
│   ├── binding.sln        # Visual Studio解决方案文件
│   ├── config.gypi        # node-gyp生成的配置文件，包含平台和编译选项
│   ├── input_wrap.vcxproj  # Visual Studio项目文件，定义构建规则
│   └── input_wrap.vcxproj.filters  # VS项目过滤器，用于组织文件在VS中的显示
├── build.sh              # 构建脚本，用于自动化清理、编译和运行程序
├── index.js              # JavaScript主程序，演示TCP onconnection回调模式
├── package.json          # Node.js项目配置文件，定义依赖和脚本命令
└── src/                  # 源代码目录
└── input_wrap.cc     # C++插件源码，实现跨语言回调机制（类似TCPWrap）


### 关键文件
#
cb-demo/
├── binding.gyp            # node-gyp构建配置，定义如何编译C++插件
├── build/                 # 构建生成目录（Windows MSBuild输出）
│   ├── Release/           # Release编译结果
│   │   ├── input_wrap.exp  # 导出符号表，用于动态链接
│   │   ├── input_wrap.iobj  # 增量编译对象文件
│   │   ├── input_wrap.ipdb  # 增量编译调试数据库
│   │   ├── input_wrap.lib   # 静态库文件
│   │   ├── input_wrap.node  # Node.js C++插件主文件（可执行）
│   │   └── input_wrap.pdb   # 程序调试数据库
│   ├── binding.sln        # Visual Studio解决方案文件
│   ├── config.gypi        # node-gyp生成的配置，包含平台信息
│   └── input_wrap.vcxproj  # Visual Studio C++项目文件
├── build.sh               # 构建脚本，自动化编译运行
├── index.js              # JavaScript主程序，演示跨语言回调
├── package.json          # Node.js项目配置，定义依赖和脚本
└── src/
└── input_wrap.cc     # C++插件源码，实现类似TCPWrap的回调机制

