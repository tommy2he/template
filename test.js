const testObject = {
  name: 'test',
  value: 123,
  // 故意写成不规范的格式测试格式化
  nested: { hello: 'world' },
};

console.log(testObject);

console.log(JSON.stringify(testObject, null, 2));

function test() {
  const x = 1;
  const y = 2;
  return x + y;
}
const obj = { a: 1, b: 2 };
console.log('测试:', obj);
let unusedVar = '这个变量没用';
