const addon = require('./build/Release/input_wrap.node');

console.log('🎯 演示 TCP onconnection 模式');
console.log('==============================\n');

// 测试直接调用
console.log('1. 测试直接调用 C++ 函数:');
const result = addon.sayHello();
console.log('   结果:', result);

// 设置回调（类似 TCP.onconnection）
console.log('\n2. 设置回调函数（类似 TCP.onconnection）:');
addon.setCallback(function onData(data) {
    console.log('   JavaScript 回调被调用，收到数据:', data);
});

// 启动输入监听
console.log('\n3. 启动输入监听:');
console.log('   这个函数模拟了 libuv 的事件循环');
console.log('   C++ 将监听键盘输入，并可以调用 JavaScript 回调\n');

addon.startInput();