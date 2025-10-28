#!/usr/bin/env node
/**
 * MCP问题诊断脚本
 * 分析MCP初始化问题的根本原因
 */

const fs = require('fs');
const path = require('path');

async function diagnoseMCPIssue() {
    console.log('🔍 MCP问题诊断开始...\n');
    
    const issues = [];
    const recommendations = [];
    
    // 1. 检查配置文件
    console.log('1️⃣ 检查配置文件...');
    
    const configFiles = [
        'config/database.json',
        'config/mcp.json',
        'config/llm.json'
    ];
    
    for (const configFile of configFiles) {
        const filePath = path.join(process.cwd(), configFile);
        if (fs.existsSync(filePath)) {
            console.log(`   ✓ ${configFile} 存在`);
            
            try {
                const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                if (configFile === 'config/mcp.json') {
                    const servers = Object.keys(content.mcpServers || {});
                    console.log(`     - 配置了 ${servers.length} 个MCP服务器: ${servers.join(', ')}`);
                    
                    // 检查HTTP服务器配置
                    for (const [name, config] of Object.entries(content.mcpServers || {})) {
                        if (config.transport === 'http') {
                            console.log(`     - HTTP服务器 ${name}: ${config.url}`);
                            if (!config.url) {
                                issues.push(`HTTP服务器 ${name} 缺少URL配置`);
                            }
                        }
                    }
                }
            } catch (error) {
                issues.push(`${configFile} 格式错误: ${error.message}`);
            }
        } else {
            issues.push(`配置文件 ${configFile} 不存在`);
            if (fs.existsSync(filePath + '.example')) {
                recommendations.push(`复制 ${configFile}.example 到 ${configFile} 并配置`);
            }
        }
    }
    
    // 2. 检查数据库连接
    console.log('\n2️⃣ 检查数据库连接...');
    
    const dbConfigPath = path.join(process.cwd(), 'config', 'database.json');
    if (fs.existsSync(dbConfigPath)) {
        try {
            const dbConfig = JSON.parse(fs.readFileSync(dbConfigPath, 'utf-8'));
            if (dbConfig.postgresql) {
                console.log(`   ✓ 数据库配置: ${dbConfig.postgresql.host}:${dbConfig.postgresql.port}/${dbConfig.postgresql.database}`);
                
                // 尝试连接测试
                try {
                    const { Pool } = require('pg');
                    const pool = new Pool(dbConfig.postgresql);
                    const client = await pool.connect();
                    await client.query('SELECT NOW()');
                    client.release();
                    await pool.end();
                    console.log('   ✓ 数据库连接测试成功');
                } catch (dbError) {
                    issues.push(`数据库连接失败: ${dbError.message}`);
                    recommendations.push('检查数据库服务是否运行，配置是否正确');
                }
            } else {
                issues.push('数据库配置中缺少postgresql配置');
            }
        } catch (error) {
            issues.push(`数据库配置解析失败: ${error.message}`);
        }
    }
    
    // 3. 检查MCP服务器可达性
    console.log('\n3️⃣ 检查MCP服务器可达性...');
    
    const mcpConfigPath = path.join(process.cwd(), 'config', 'mcp.json');
    if (fs.existsSync(mcpConfigPath)) {
        try {
            const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'));
            
            for (const [name, config] of Object.entries(mcpConfig.mcpServers || {})) {
                if (config.transport === 'http' && config.url) {
                    console.log(`   测试HTTP服务器 ${name}: ${config.url}`);
                    
                    try {
                        const response = await fetch(config.url, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                jsonrpc: '2.0',
                                id: 1,
                                method: 'initialize',
                                params: {
                                    protocolVersion: '2024-11-05',
                                    capabilities: { tools: {} },
                                    clientInfo: { name: 'diagnostic-script', version: '1.0.0' }
                                }
                            }),
                            signal: AbortSignal.timeout(10000)
                        });
                        
                        if (response.ok) {
                            console.log(`   ✓ HTTP服务器 ${name} 可达`);
                        } else {
                            issues.push(`HTTP服务器 ${name} 返回错误: ${response.status} ${response.statusText}`);
                        }
                    } catch (fetchError) {
                        issues.push(`HTTP服务器 ${name} 连接失败: ${fetchError.message}`);
                        recommendations.push(`检查 ${config.url} 是否可访问，服务是否运行`);
                    }
                } else if (config.transport === 'stdio' || !config.transport) {
                    console.log(`   STDIO服务器 ${name}: ${config.command || 'uvx'} ${(config.args || []).join(' ')}`);
                    // STDIO服务器需要实际的进程测试，这里只记录配置
                }
            }
        } catch (error) {
            issues.push(`MCP配置解析失败: ${error.message}`);
        }
    }
    
    // 4. 检查启动脚本和环境
    console.log('\n4️⃣ 检查启动环境...');
    
    const packageJsonPath = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const devScript = packageJson.scripts?.dev;
        
        if (devScript && devScript.includes('startup-init.js')) {
            console.log('   ✓ 启动脚本包含初始化步骤');
        } else {
            issues.push('启动脚本可能缺少初始化步骤');
            recommendations.push('确保dev脚本包含: node scripts/startup-init.js && next dev');
        }
    }
    
    // 检查环境变量
    const envFile = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envFile)) {
        console.log('   ✓ .env.local 文件存在');
    } else {
        recommendations.push('创建 .env.local 文件，设置 MCP_STARTUP_DELAY=3000');
    }
    
    // 5. 检查日志和状态文件
    console.log('\n5️⃣ 检查状态文件...');
    
    const statusFile = path.join(process.cwd(), '.next', 'mcp-status.json');
    if (fs.existsSync(statusFile)) {
        try {
            const status = JSON.parse(fs.readFileSync(statusFile, 'utf-8'));
            console.log('   ✓ 找到MCP状态文件');
            console.log(`     - 状态: ${status.ready ? '就绪' : '未就绪'}`);
            console.log(`     - 时间: ${status.timestamp}`);
            
            const age = (new Date() - new Date(status.timestamp)) / 1000 / 60;
            if (age > 60) {
                recommendations.push('MCP状态文件已过期，建议重新初始化');
            }
        } catch (error) {
            issues.push(`MCP状态文件格式错误: ${error.message}`);
        }
    } else {
        console.log('   - MCP状态文件不存在（正常，首次运行时）');
    }
    
    // 输出诊断结果
    console.log('\n' + '='.repeat(50));
    console.log('📋 诊断结果');
    console.log('='.repeat(50));
    
    if (issues.length === 0) {
        console.log('✅ 未发现明显问题');
        console.log('\n如果MCP仍然不正常，可能是时序问题。建议:');
        console.log('1. 设置环境变量 MCP_STARTUP_DELAY=5000');
        console.log('2. 重启应用');
        console.log('3. 观察启动日志');
    } else {
        console.log('❌ 发现以下问题:');
        issues.forEach((issue, index) => {
            console.log(`${index + 1}. ${issue}`);
        });
    }
    
    if (recommendations.length > 0) {
        console.log('\n💡 建议的解决方案:');
        recommendations.forEach((rec, index) => {
            console.log(`${index + 1}. ${rec}`);
        });
    }
    
    console.log('\n🔧 快速修复命令:');
    console.log('npm run mcp:fix          # 应用所有修复');
    console.log('npm run db:init          # 重新初始化数据库');
    console.log('npm run test:mcp:config  # 测试MCP配置');
    console.log('npm run dev              # 启动应用（观察日志）');
}

if (require.main === module) {
    diagnoseMCPIssue().catch(error => {
        console.error('诊断脚本执行失败:', error);
        process.exit(1);
    });
}

module.exports = { diagnoseMCPIssue };