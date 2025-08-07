const fs = require('fs');
const path = require('path');

// CouponEntry 组件修复
function fixCouponEntry() {
    const filePath = '../src/pages/festivalPromotion/components/CouponEntry/index.tsx';
    console.log('🔧 修复 CouponEntry 组件...');

    try {
        let content = fs.readFileSync(filePath, 'utf-8');

        // 添加 safeMath 导入
        if (!content.includes('safeDivDecimals')) {
            content = content.replace(
                "import { divDecimals } from '@utiljs/math';",
                "import { divDecimals } from '@utiljs/math';\nimport { safeDivDecimals } from '@utils/safeMath';"
            );
        }

        // 修复解构赋值的安全性
        content = content.replace(
            /const { limitAmount = 0, rate = 0 } = item;/g,
            'const { limitAmount = 0, rate = 0 } = item || {};'
        );

        // 修复 divDecimals 调用
        content = content.replace(
            /const couponAmount = divDecimals\(limitAmount, 100\);/g,
            'const couponAmount = safeDivDecimals(limitAmount, 100);'
        );

        content = content.replace(
            /const rateStr = rate > 0 \? divDecimals\(rate, 100\)\.toString\(\)\.split\('\\.'\)\[1\] : '';/g,
            `const rateStr = (typeof rate === 'number' && rate > 0) ?
    safeDivDecimals(rate, 100).toString().split('.')[1] : '';`
        );

        fs.writeFileSync(filePath, content);
        console.log('✅ CouponEntry 组件修复完成');

    } catch (error) {
        console.error('❌ CouponEntry 修复失败:', error.message);
    }
}

// CouponItem 组件修复
function fixCouponItem() {
    const filePath = '../src/pages/festivalPromotionV2/components/FesRights/CouponItem/index.tsx';
    console.log('🔧 修复 CouponItem 组件...');

    try {
        let content = fs.readFileSync(filePath, 'utf-8');

        // 添加 safeMath 导入
        if (!content.includes('safeDivDecimals')) {
            content = content.replace(
                "import { divDecimals } from '@utiljs/math';",
                "import { divDecimals } from '@utiljs/math';\nimport { safeDivDecimals } from '@utils/safeMath';"
            );
        }

        // 修复函数参数默认值
        content = content.replace(
            /export default \(\{ rightsType, rate, limitAmount, allowance \}: FesRight\) => \{/,
            `export default ({
    rightsType,
    rate = 0,
    limitAmount = 0,
    allowance = 0
}: FesRight) => {`
        );

        // 替换不安全的函数调用
        content = content.replace(
            /const couponAmount = divDecimals\(limitAmount, 100\);/g,
            'const couponAmount = safeDivDecimals(limitAmount, 100);'
        );

        content = content.replace(
            /const reduceAmount = allowance \? divDecimals\(allowance, 100\) : '0';/g,
            'const reduceAmount = allowance ? safeDivDecimals(allowance, 100) : "0";'
        );

        content = content.replace(
            /const rateStr = rate > 0 \? divDecimals\(rate, 100\)\.toString\(\)\.split\('\\.'\)\[1\] : '0';/g,
            `const rateStr = (typeof rate === 'number' && rate > 0) ?
    safeDivDecimals(rate, 100).toString().split('.')[1] : '0';`
        );

        fs.writeFileSync(filePath, content);
        console.log('✅ CouponItem 组件修复完成');

    } catch (error) {
        console.error('❌ CouponItem 修复失败:', error.message);
    }
}

// utils/utils.ts 修复
function fixUtils() {
    const filePath = '../src/utils/utils.ts';
    console.log('🔧 修复 utils.ts...');

    try {
        let content = fs.readFileSync(filePath, 'utf-8');

        // 添加 safeMath 导入
        if (!content.includes('safeDivDecimals')) {
            content = content.replace(
                "import { mulDecimals, divDecimals } from '@utiljs/math';",
                "import { mulDecimals, divDecimals } from '@utiljs/math';\nimport { safeDivDecimals, safeMulDecimals } from './safeMath';"
            );
        }

        // 替换格式化函数
        content = content.replace(
            /export const formatFenToYuan = \(value: string \| number\) => divDecimals\(\(Number\(value\) \|\| 0\), 100\);/g,
            'export const formatFenToYuan = (value: string | number) => safeDivDecimals(value, 100);'
        );

        content = content.replace(
            /export const formatYuanToFen = \(value: string \| number\) => mulDecimals\(\(Number\(value\) \|\| 0\), 100\);/g,
            'export const formatYuanToFen = (value: string | number) => safeMulDecimals(value, 100);'
        );

        fs.writeFileSync(filePath, content);
        console.log('✅ utils.ts 修复完成');

    } catch (error) {
        console.error('❌ utils.ts 修复失败:', error.message);
    }
}

// 生成修复报告
function generateReport() {
    console.log('\n📊 修复报告生成中...\n');

    const report = {
        timestamp: new Date().toISOString(),
        fixes: [
            {
                component: 'CouponEntry',
                file: 'src/pages/festivalPromotion/components/CouponEntry/index.tsx',
                issues: [
                    '对象解构添加默认值保护',
                    'divDecimals 替换为 safeDivDecimals',
                    '类型检查增强'
                ]
            },
            {
                component: 'CouponItem',
                file: 'src/pages/festivalPromotionV2/components/FesRights/CouponItem/index.tsx',
                issues: [
                    '函数参数添加默认值',
                    '安全函数调用替换',
                    '类型检查增强'
                ]
            },
            {
                component: 'Utils',
                file: 'src/utils/utils.ts',
                issues: [
                    '格式化函数安全化',
                    '参数验证增强'
                ]
            }
        ],
        recommendations: [
            '建议在 CI/CD 中集成 AST 安全检查',
            '定期运行安全检测脚本',
            '为新组件添加参数类型检查',
            '考虑启用 TypeScript 严格模式'
        ]
    };

    fs.writeFileSync('./fix-report.json', JSON.stringify(report, null, 2));

    console.log('📝 修复总结:');
    console.log('='.repeat(50));
    report.fixes.forEach((fix, index) => {
        console.log(`${index + 1}. ${fix.component} (${fix.file})`);
        fix.issues.forEach(issue => console.log(`   - ${issue}`));
    });

    console.log('\n💡 建议:');
    report.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
    });

    console.log('\n✅ 修复报告已保存到: fix-report.json');
}

// 运行所有修复
function runAllFixes() {
    console.log('🚀 开始自动化修复...\n');

    fixCouponEntry();
    fixCouponItem();
    fixUtils();

    console.log('\n🎉 所有修复完成!');
    generateReport();

    console.log('\n📋 下一步操作:');
    console.log('1. 运行测试: npm test');
    console.log('2. 构建检查: npm run build');
    console.log('3. 手动验证组件功能');
    console.log('4. 提交代码变更');
}

// 如果直接运行此脚本
if (require.main === module) {
    runAllFixes();
}

module.exports = {
    fixCouponEntry,
    fixCouponItem,
    fixUtils,
    runAllFixes
};
