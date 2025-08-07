# scan-decimal# AST 安全检测工具

## 功能概述

这个工具能够通过 AST 分析自动检测项目中可能导致页面白屏的 JavaScript/TypeScript 代码问题，特别针对数学工具函数（如 `divDecimals`、`mulDecimals` 等）的不安全调用。

## 检测的问题类型

### 🔴 高风险问题
- 未定义的变量作为函数参数
- 全局变量的不安全使用

### 🟡 中风险问题
- 函数参数没有默认值
- 对象解构时缺少默认值
- 变量声明时未初始化

### 🟠 低风险问题
- 成员表达式可能访问 undefined 属性
- 嵌套函数调用的潜在风险

## 使用方法

### 方法一：运行脚本
```bash
./scripts/run-safety-check.sh
```

### 方法二：手动运行
```bash
cd scripts
npm install @babel/parser @babel/traverse glob
node ast-safety-checker.js ../src
```

### 方法三：检查特定目录
```bash
cd scripts
node ast-safety-checker.js ../src/pages/festivalPromotion
```

## 常见问题修复建议

### 1. CouponEntry 组件问题
**原代码:**
```typescript
const { limitAmount = 0, rate = 0 } = item;
const couponAmount = divDecimals(limitAmount, 100);
```

**修复方案:**
```typescript
// 方案1：增强解构安全性
const { limitAmount = 0, rate = 0 } = item || {};
const couponAmount = divDecimals(limitAmount, 100);

// 方案2：添加类型检查
const couponAmount = typeof limitAmount === 'number'
  ? divDecimals(limitAmount, 100)
  : 0;

// 方案3：使用Number转换+默认值
const couponAmount = divDecimals(Number(limitAmount) || 0, 100);
```

### 2. CouponItem 组件问题
**原代码:**
```typescript
const couponAmount = divDecimals(limitAmount, 100);
```

**修复方案:**
```typescript
// 方案1：参数默认值
export default ({ rightsType, rate = 0, limitAmount = 0, allowance = 0 }: FesRight) => {
  const couponAmount = divDecimals(limitAmount, 100);
  // ...
}

// 方案2：运行时检查
const couponAmount = divDecimals(limitAmount ?? 0, 100);
```

### 3. TaskItem 组件问题
**原代码:**
```typescript
const rateStr = rate > 0 ? divDecimals(rate, 100).toString().split('.')[1] : '';
```

**修复方案:**
```typescript
// 更安全的条件判断
const rateStr = (typeof rate === 'number' && rate > 0)
  ? divDecimals(rate, 100).toString().split('.')[1]
  : '';
```

### 4. 工具函数增强
**创建安全的包装函数:**
```typescript
// src/utils/safeMath.ts
import { divDecimals as originalDivDecimals, mulDecimals as originalMulDecimals } from '@utiljs/math';

export const safeDivDecimals = (dividend: any, divisor: any, precision?: number) => {
  const safeDividend = Number(dividend) || 0;
  const safeDivisor = Number(divisor) || 1; // 避免除零
  return originalDivDecimals(safeDividend, safeDivisor, precision);
};

export const safeMulDecimals = (multiplicand: any, multiplier: any, precision?: number) => {
  const safeMultiplicand = Number(multiplicand) || 0;
  const safeMultiplier = Number(multiplier) || 0;
  return originalMulDecimals(safeMultiplicand, safeMultiplier, precision);
};
```

## 集成到 CI/CD

可以将此检查集成到开发流程中：

```json
// package.json
{
  "scripts": {
    "safety-check": "cd scripts && node ast-safety-checker.js ../src",
    "pre-commit": "npm run safety-check && npm run lint",
    "ci-check": "npm run safety-check"
  }
}
```

## 输出示例

```
🔍 开始 AST 安全检查...

📊 检查完成，发现 5 个潜在问题:

🔴 高风险 (1 个问题):
==================================================

1. src/pages/example/index.tsx:25:12
   函数: divDecimals(), 参数: 1
   问题: 变量 'amount' 未在作用域中找到，可能为全局变量或未定义
   代码: divDecimals(amount, 100)
   建议:
   - 检查变量 'amount' 是否正确导入或定义

🟡 中风险 (2 个问题):
==================================================
...
```

## 注意事项

1. 此工具基于静态代码分析，可能存在误报
2. 建议结合人工 Code Review 使用
3. 对于复杂的动态代码路径，可能无法完全检测
4. 定期更新检测规则以覆盖新的问题模式
