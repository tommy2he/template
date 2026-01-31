#include <node_api.h>
#include <iostream>
#include <string>

namespace demo {

// 简化的回调函数
static napi_value SayHello(napi_env env, napi_callback_info info) {
    napi_value greeting;
    napi_create_string_utf8(env, "Hello from C++", NAPI_AUTO_LENGTH, &greeting);
    
    std::cout << "C++: 收到 JavaScript 调用" << std::endl;
    
    return greeting;
}

// 模拟 TCP onconnection 的回调设置
static napi_value SetCallback(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value argv[1];
    napi_value this_arg;
    
    napi_get_cb_info(env, info, &argc, argv, &this_arg, nullptr);
    
    std::cout << "C++: JavaScript 回调函数已设置" << std::endl;
    std::cout << "C++: 这个函数模拟了 TCPWrap 的 onconnection 设置" << std::endl;
    
    // 这里可以保存回调函数引用，类似 TCPWrap 保存 js_callback_ref
    
    napi_value result;
    napi_get_undefined(env, &result);
    return result;
}

// 模拟键盘输入
static napi_value StartInput(napi_env env, napi_callback_info info) {
    std::cout << "\nC++: 开始监听键盘输入..." << std::endl;
    std::cout << "C++: 输入 'test' 来触发回调" << std::endl;
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
        
        // 这里可以调用保存的 JavaScript 回调，类似 TCPWrap::OnConnection
        if (input == "test") {
            std::cout << "C++: 模拟调用 JavaScript 回调（类似 TCPWrap::OnConnection）" << std::endl;
        }
    }
    
    napi_value result;
    napi_get_undefined(env, &result);
    return result;
}

// 初始化函数
napi_value Init(napi_env env, napi_value exports) {
    napi_property_descriptor desc[] = {
        { "sayHello", 0, SayHello, 0, 0, 0, napi_default, 0 },
        { "setCallback", 0, SetCallback, 0, 0, 0, napi_default, 0 },
        { "startInput", 0, StartInput, 0, 0, 0, napi_default, 0 }
    };
    
    napi_define_properties(env, exports, 3, desc);
    
    std::cout << "C++: 模块初始化完成" << std::endl;
    return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)

} // namespace demo