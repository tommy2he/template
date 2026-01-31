#include <node_api.h>
#include <iostream>
#include <string>
#include <vector>
#include <sstream>

namespace demo {

// 全局变量，保存 JavaScript 回调的引用
static napi_ref js_callback_ref = nullptr;
static napi_env callback_env = nullptr;

// 解析输入字符串为数字数组
std::vector<int> parseInput(const std::string& input) {
    std::vector<int> numbers;
    std::istringstream iss(input);
    std::string token;
    
    while (iss >> token) {
        try {
            numbers.push_back(std::stoi(token));
        } catch (...) {
            // 忽略非数字输入
        }
    }
    
    return numbers;
}

// 模拟 TCP onconnection 的回调设置
static napi_value SetCallback(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value argv[1];
    napi_value this_arg;
    
    napi_get_cb_info(env, info, &argc, argv, &this_arg, nullptr);
    
    if (argc < 1) {
        std::cerr << "C++: 需要一个回调函数参数" << std::endl;
        return nullptr;
    }
    
    // 保存回调函数的引用（类似 TCPWrap 保存 onconnection）
    napi_create_reference(env, argv[0], 1, &js_callback_ref);
    callback_env = env;
    
    std::cout << "C++: JavaScript 回调函数已保存（类似 TCP.onconnection）" << std::endl;
    
    napi_value result;
    napi_get_undefined(env, &result);
    return result;
}

// 调用 JavaScript 回调（类似 TCPWrap::OnConnection）
void CallJsCallback(const std::vector<int>& numbers) {
    if (!js_callback_ref || !callback_env) {
        std::cout << "C++: 警告：没有设置 JavaScript 回调" << std::endl;
        return;
    }
    
    napi_handle_scope scope;
    napi_open_handle_scope(callback_env, &scope);
    
    // 获取保存的 JavaScript 回调函数
    napi_value js_callback;
    napi_get_reference_value(callback_env, js_callback_ref, &js_callback);
    
    // 创建 JavaScript 数组参数
    napi_value js_array;
    napi_create_array(callback_env, &js_array);
    
    for (size_t i = 0; i < numbers.size(); i++) {
        napi_value js_num;
        napi_create_int32(callback_env, numbers[i], &js_num);
        napi_set_element(callback_env, js_array, i, js_num);
    }
    
    // 准备参数
    napi_value argv[1];
    argv[0] = js_array;
    
    // 全局对象作为 this
    napi_value global;
    napi_get_global(callback_env, &global);
    
    std::cout << "C++: 正在调用 JavaScript 回调（类似 TCPWrap::OnConnection）..." << std::endl;
    
    // 🎯 关键：调用 JavaScript 回调！
    napi_value result;
    napi_call_function(callback_env, global, js_callback, 1, argv, &result);
    
    napi_close_handle_scope(callback_env, scope);
}

// 模拟键盘输入
static napi_value StartInput(napi_env env, napi_callback_info info) {
    std::cout << "\nC++: 开始监听键盘输入（类似 libuv 事件循环）..." << std::endl;
    std::cout << "C++: 输入4个数字（空格分隔）触发回调" << std::endl;
    std::cout << "C++: 输入 'quit' 退出" << std::endl;
    
    std::string input;
    while (true) {
        std::cout << "\n输入: ";
        std::getline(std::cin, input);
        
        if (input == "quit") {
            std::cout << "C++: 退出" << std::endl;
            break;
        }
        
        std::cout << "C++: 收到输入: " << input << std::endl;
        
        // 解析输入
        std::vector<int> numbers = parseInput(input);
        
        if (numbers.size() == 4) {
            std::cout << "C++: 解析到4个数字，准备调用 JavaScript 回调" << std::endl;
            
            // 🎯 关键：调用 JavaScript 回调（类似 TCPWrap::OnConnection）
            CallJsCallback(numbers);
        } else {
            std::cout << "C++: 需要4个数字，请重新输入" << std::endl;
        }
    }
    
    napi_value result;
    napi_get_undefined(env, &result);
    return result;
}

// 简化的回调函数（保持原有功能）
static napi_value SayHello(napi_env env, napi_callback_info info) {
    napi_value greeting;
    napi_create_string_utf8(env, "Hello from C++", NAPI_AUTO_LENGTH, &greeting);
    
    std::cout << "C++: 收到 JavaScript 调用" << std::endl;
    
    return greeting;
}

// 初始化函数
napi_value Init(napi_env env, napi_value exports) {
    napi_property_descriptor desc[] = {
        { "sayHello", 0, SayHello, 0, 0, 0, napi_default, 0 },
        { "setCallback", 0, SetCallback, 0, 0, 0, napi_default, 0 },
        { "startInput", 0, StartInput, 0, 0, 0, napi_default, 0 }
    };
    
    napi_define_properties(env, exports, 3, desc);
    
    std::cout << "C++: 模块初始化完成（类似 TCPWrap 初始化）" << std::endl;
    return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)

} // namespace demo