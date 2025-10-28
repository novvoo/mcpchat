// 测试中文参数提取
function testChineseExtraction(message) {
  console.log(`\n测试消息: "${message}"`);
  
  let headsValue = null;
  let legsValue = null;
  
  // 策略：找到包含"头"或"heads"的数字
  const headMatches = [
    ...message.matchAll(/(?:total_)?heads?\s*[:\s]*(\d+)/gi),
    ...message.matchAll(/(\d+)\s*(?:个)?头/g),
    ...message.matchAll(/头\s*(\d+)/g)
  ];
  
  // 策略：找到包含"腿"或"legs"的数字  
  const legMatches = [
    ...message.matchAll(/(?:total_)?legs?\s*[:\s]*(\d+)/gi),
    ...message.matchAll(/(\d+)\s*(?:条)?腿/g),
    ...message.matchAll(/腿\s*(\d+)/g)
  ];
  
  console.log('头部所有匹配:', headMatches.map(m => `${m[0]} -> ${m[1]}`));
  console.log('腿部所有匹配:', legMatches.map(m => `${m[0]} -> ${m[1]}`));
  
  // 选择第一个匹配
  if (headMatches.length > 0) {
    headsValue = parseInt(headMatches[0][1]);
  }
  
  if (legMatches.length > 0) {
    legsValue = parseInt(legMatches[0][1]);
  }

  if (headsValue !== null && legsValue !== null) {
    const result = {
      total_heads: headsValue,
      total_legs: legsValue
    };
    console.log('提取结果:', result);
    return result;
  } else {
    console.log('提取失败');
    return null;
  }
}

// 测试各种中文格式
const testCases = [
  '鸡兔同笼问题 35个头 94条腿',
  '鸡兔同笼 共有35个头 94条腿',
  '鸡兔问题 总共35头 94腿',
  '35个头94条腿的鸡兔同笼',
  '鸡兔同笼 头35 腿94',
  'chicken rabbit problem total_heads 35 total_legs 94',
  '35 heads 94 legs'
];

testCases.forEach(testChineseExtraction);