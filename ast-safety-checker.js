const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const glob = require('glob');

// 需要检测的危险函数列表
const DANGEROUS_FUNCTIONS = [
  'divDecimals',
  'mulDecimals',
  'addDecimals',
  'subDecimals'
];

// 安全的数字检查函数
const SAFE_NUMBER_CHECKS = [
  'Number',
  'parseInt',
  'parseFloat',
  'isNaN',
  'isFinite'
];

class ASTSafetyChecker {
  constructor() {
    this.issues = [];
  }

  // 检查单个文件
  checkFile(filePath) {
    try {
      const code = fs.readFileSync(filePath, 'utf-8');
      const ast = parse(code, {
        sourceType: 'module',
        plugins: [
          'jsx',
          'typescript',
          'decorators-legacy',
          'classProperties',
          'objectRestSpread',
          'asyncGenerators',
          'dynamicImport'
        ]
      });

      traverse(ast, {
        CallExpression: (path) => {
          this.checkFunctionCall(path, filePath);
        }
      });
    } catch (error) {
      console.error(`Error parsing ${filePath}:`, error.message);
    }
  }

  // 检查函数调用
  checkFunctionCall(path, filePath) {
    const { node } = path;
    const callee = node.callee;

    // 检查直接函数调用
    if (callee.type === 'Identifier' && DANGEROUS_FUNCTIONS.includes(callee.name)) {
      this.analyzeFunctionCall(path, filePath, callee.name);
    }
  }

  // 分析具体的函数调用
  analyzeFunctionCall(path, filePath, functionName) {
    const { node, scope } = path;
    const args = node.arguments;

    if (args.length === 0) return;

    args.forEach((arg, index) => {
      const risk = this.analyzeArgument(arg, scope, path);
      if (risk.level > 0) {
        this.issues.push({
          file: filePath,
          line: node.loc ? node.loc.start.line : 'unknown',
          column: node.loc ? node.loc.start.column : 'unknown',
          function: functionName,
          argument: index + 1,
          risk: risk,
          code: this.getCodeSnippet(path)
        });
      }
    });
  }

  // 分析参数的风险等级
  analyzeArgument(arg, scope, path) {
    const risk = { level: 0, reason: '', suggestions: [] };

    switch (arg.type) {
      case 'Identifier':
        return this.analyzeIdentifier(arg, scope, path);

      case 'MemberExpression':
        return this.analyzeMemberExpression(arg, scope, path);

      case 'ConditionalExpression':
        return this.analyzeConditionalExpression(arg, scope, path);

      case 'CallExpression':
        return this.analyzeCallExpression(arg, scope, path);

      case 'NumericLiteral':
      case 'StringLiteral':
        // 字面量是安全的
        return risk;

      default:
        risk.level = 1;
        risk.reason = `未知的参数类型: ${arg.type}`;
        return risk;
    }
  }

  // 分析标识符
  analyzeIdentifier(arg, scope, path) {
    const risk = { level: 0, reason: '', suggestions: [] };
    const binding = scope.getBinding(arg.name);

    if (!binding) {
      risk.level = 3;
      risk.reason = `变量 '${arg.name}' 未在作用域中找到，可能为全局变量或未定义`;
      risk.suggestions.push(`检查变量 '${arg.name}' 是否正确导入或定义`);
      return risk;
    }

    // 检查变量初始化
    if (binding.path.isVariableDeclarator()) {
      const init = binding.path.node.init;
      if (!init) {
        risk.level = 2;
        risk.reason = `变量 '${arg.name}' 声明时未初始化`;
        risk.suggestions.push(`为变量 '${arg.name}' 提供默认值`);
      }
    }

    // 检查函数参数
    if (binding.path.isParameter()) {
      const param = binding.path.node;
      if (!param.defaultValue) {
        risk.level = 2;
        risk.reason = `函数参数 '${arg.name}' 没有默认值`;
        risk.suggestions.push(`为参数 '${arg.name}' 设置默认值，如: ${arg.name} = 0`);
      }
    }

    return risk;
  }

  // 分析成员表达式 (如 obj.prop)
  analyzeMemberExpression(arg, scope, path) {
    const risk = { level: 0, reason: '', suggestions: [] };

    // 检查是否有可选链
    if (arg.optional) {
      return risk; // 可选链是安全的
    }

    // 检查解构赋值的默认值
    const parent = path.findParent(p => p.isVariableDeclarator());
    if (parent) {
      const id = parent.node.id;
      if (id.type === 'ObjectPattern') {
        const property = id.properties.find(prop =>
          prop.key && prop.key.name === arg.property.name
        );
        if (property && !property.value.defaultValue) {
          risk.level = 2;
          risk.reason = `属性 '${arg.property.name}' 没有默认值，对象可能为空`;
          risk.suggestions.push(`为属性设置默认值: { ${arg.property.name} = 0 } = obj`);
        }
      }
    }

    risk.level = 1;
    risk.reason = `成员表达式可能访问 undefined 的属性`;
    risk.suggestions.push(`使用可选链: ${this.getCodeSnippet(arg)}?.${arg.property.name}`);
    risk.suggestions.push(`添加默认值检查: (${this.getCodeSnippet(arg)} || 0)`);

    return risk;
  }

  // 分析条件表达式
  analyzeConditionalExpression(arg, scope, path) {
    const risk = { level: 0, reason: '', suggestions: [] };

    // 检查条件表达式的两个分支
    const consequent = this.analyzeArgument(arg.consequent, scope, path);
    const alternate = this.analyzeArgument(arg.alternate, scope, path);

    const maxRisk = Math.max(consequent.level, alternate.level);
    if (maxRisk > 0) {
      risk.level = maxRisk;
      risk.reason = `条件表达式的分支可能存在风险`;
      risk.suggestions = [...(consequent.suggestions || []), ...(alternate.suggestions || [])];
    }

    return risk;
  }

  // 分析函数调用表达式
  analyzeCallExpression(arg, scope, path) {
    const risk = { level: 0, reason: '', suggestions: [] };

    if (arg.callee.type === 'Identifier') {
      if (SAFE_NUMBER_CHECKS.includes(arg.callee.name)) {
        return risk; // 安全的数字转换函数
      }

      if (DANGEROUS_FUNCTIONS.includes(arg.callee.name)) {
        risk.level = 1;
        risk.reason = `嵌套调用可能传播 undefined 值`;
        risk.suggestions.push(`检查嵌套函数调用的安全性`);
      }
    }

    return risk;
  }

  // 获取代码片段
  getCodeSnippet(path) {
    try {
      if (path.node && path.hub && path.hub.file && path.hub.file.code) {
        const start = path.node.start;
        const end = path.node.end;
        return path.hub.file.code.slice(start, end);
      }
      return path.node ? `[${path.node.type}]` : '[unknown]';
    } catch {
      return '[code unavailable]';
    }
  }

  // 运行检查
  run(srcDir = 'src') {
    console.log('🔍 开始 AST 安全检查...\n');

    const files = glob.sync(`${srcDir}/**/*.{ts,tsx,js,jsx}`, {
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
    });

    files.forEach(file => {
      this.checkFile(file);
    });

    this.generateReport();
  }

  // 生成报告
  generateReport() {
    console.log(`\n📊 检查完成，发现 ${this.issues.length} 个潜在问题:\n`);

    // 按风险等级分组
    const groupedIssues = {
      high: this.issues.filter(i => i.risk.level >= 3),
      medium: this.issues.filter(i => i.risk.level === 2),
      low: this.issues.filter(i => i.risk.level === 1)
    };

    ['high', 'medium', 'low'].forEach(level => {
      const issues = groupedIssues[level];
      if (issues.length > 0) {
        const levelNames = { high: '🔴 高风险', medium: '🟡 中风险', low: '🟠 低风险' };
        console.log(`\n${levelNames[level]} (${issues.length} 个问题):`);
        console.log('='.repeat(50));

        issues.forEach((issue, index) => {
          console.log(`\n${index + 1}. ${issue.file}:${issue.line}:${issue.column}`);
          console.log(`   函数: ${issue.function}(), 参数: ${issue.argument}`);
          console.log(`   问题: ${issue.risk.reason}`);
          console.log(`   代码: ${issue.code}`);

          if (issue.risk.suggestions.length > 0) {
            console.log('   建议:');
            issue.risk.suggestions.forEach(suggestion => {
              console.log(`   - ${suggestion}`);
            });
          }
        });
      }
    });

    // 生成修复建议总结
    this.generateFixSuggestions();
  }

  // 生成修复建议
  generateFixSuggestions() {
    console.log('\n\n💡 通用修复建议:');
    console.log('='.repeat(50));

    const suggestions = [
      '1. 为函数参数设置默认值: function fn(value = 0) { ... }',
      '2. 为对象解构设置默认值: const { amount = 0 } = item || {}',
      '3. 使用可选链操作符: item?.amount',
      '4. 添加类型检查: typeof value === "number" ? divDecimals(value, 100) : 0',
      '5. 使用 Number() 转换并提供默认值: divDecimals(Number(value) || 0, 100)',
      '6. 在组件层面添加数据验证逻辑',
      '7. 考虑使用 TypeScript 严格模式来提前发现类型问题'
    ];

    suggestions.forEach(suggestion => console.log(suggestion));
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  const checker = new ASTSafetyChecker();
  const srcDir = process.argv[2] || 'src';
  checker.run(srcDir);
}

module.exports = ASTSafetyChecker;
