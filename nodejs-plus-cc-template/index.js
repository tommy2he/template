const addon = require('./build/Release/input_wrap.node');

console.log('🎯 演示 TCP onconnection 模式');
console.log('==============================\n');

// 24点计算函数
function calculate24Point(numbers) {
    console.log('📞 JavaScript 回调被 C++ 调用！');
    console.log('   收到数字:', numbers);
    
    const [a, b, c, d] = numbers;
    
    // 尝试一些简单的组合
    const attempts = [
        `${a}+${b}+${c}+${d}`,
        `${a}*${b}+${c}+${d}`,
        `(${a}+${b})*(${c}+${d})`,
        `${a}*${b}*${c}*${d}`,
        `(${a}*${b})+(${c}*${d})`,
        `${a}*${b}*${c}/${d}`,
        `(${a}+${b})*${c}-${d}`,
    ];
    
    console.log('🔢 尝试计算24点:');
    
    for (const expr of attempts) {
        try {
            const result = eval(expr);
            if (Math.abs(result - 24) < 0.0001) {
                console.log(`   ✅ 找到解法: ${expr} = 24`);
                return;
            }
        } catch (e) {
            // 忽略错误
        }
    }
    
    console.log('   ❌ 未找到24点解法');
}

// 设置回调（类似 TCP.onconnection）
console.log('1. 设置回调函数（类似 TCP.onconnection）:');
addon.setCallback(function onNumbersReceived(numbers) {
    // 这个函数将被 C++ 调用，就像 TCP 的 onconnection 被调用一样
    console.log('   回调函数已注册，等待 C++ 调用...');
    
    // 当 C++ 调用时，执行24点计算
    calculate24Point(numbers);
});

// 启动输入监听
console.log('\n2. 启动输入监听:');
console.log('   这个函数模拟了 libuv 的事件循环');
console.log('   C++ 将监听键盘输入，并调用 JavaScript 回调\n');

addon.startInput();