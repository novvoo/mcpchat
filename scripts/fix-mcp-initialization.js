#!/usr/bin/env node
/**
 * MCP初始化问题修复脚本
 * 解决首次启动时MCP状态不正常的问题
 */

const fs = require('fs');
const path = require('path');

class MCPInitializationFixer {
    constructor() {
        this.fixes = [];
    }

    async applyFixes() {
        console.log('🔧 开始修复MCP初始化问题...\n');

        try {
            // 修复1: 改进启动时序
            await this.fixStartupSequence();
            
            // 修复2: 添加状态持久化
            await this.addStatusPersistence();
            
            // 修复3: 改进重试机制
            await this.improveRetryMechanism();
            
            // 修复4: 添加初始化检查点
            await this.addInitializationCheckpoints();
            
            console.log('✅ 所有修复已应用\n');
            console.log('修复摘要:');
            this.fixes.forEach((fix, index) => {
                console.log(`${index + 1}. ${fix}`);
            });
            
            console.log('\n💡 建议的后续步骤:');
            console.log('1. 重启应用以应用修复');
            console.log('2. 检查 MCP 状态: npm run test:mcp:config');
            console.log('3. 如果问题仍然存在，运行: npm run db:init');
            
        } catch (error) {
            console.error('❌ 修复过程中出现错误:', error.message);
            process.exit(1);
        }
    }

    async fixStartupSequence() {
        console.log('1️⃣ 修复启动时序问题...');
        
        const instrumentationPath = path.join(process.cwd(), 'src', 'instrumentation.ts');
        
        if (!fs.existsSync(instrumentationPath)) {
            console.log('   ⚠️  instrumentation.ts 不存在，跳过');
            return;
        }

        let content = fs.readFileSync(instrumentationPath, 'utf-8');
        
        // 检查是否已经包含修复
        if (content.includes('MCP_STARTUP_DELAY')) {
            console.log('   ✓ 启动时序修复已存在');
            return;
        }

        // 添加启动延迟和更好的错误处理
        const mcpInitSection = `            // 5. 初始化 MCP 系统 - 添加延迟以确保其他服务就绪
            console.log('🔧 初始化 MCP 系统...')
            
            // 添加启动延迟，确保数据库和其他服务完全就绪
            const startupDelay = parseInt(process.env.MCP_STARTUP_DELAY || '2000')
            if (startupDelay > 0) {
                console.log(\`⏱️  等待 \${startupDelay}ms 以确保服务就绪...\`)
                await new Promise(resolve => setTimeout(resolve, startupDelay))
            }
            
            const { initializeMCPSystem, getMCPInitializer } = await import('./src/services/mcp-initializer')
            
            // 强制进行完整初始化，设置启动标志
            process.env.MCP_STARTUP_INITIALIZING = 'true'
            
            try {
                const status = await initializeMCPSystem()
                process.env.MCP_STARTUP_INITIALIZING = 'false'

                if (status.ready) {
                    console.log(\`✓ MCP 系统初始化成功 (\${status.details.totalTools} 个工具可用)\`)
                    
                    // 验证初始化状态持久化
                    const initializer = getMCPInitializer()
                    const verifyStatus = initializer.getStatus()
                    if (verifyStatus.ready) {
                        console.log('✓ MCP 系统状态已正确持久化')
                    } else {
                        console.log('⚠️  MCP 系统状态持久化可能有问题，将在后台重试')
                        // 后台重试初始化
                        setTimeout(async () => {
                            try {
                                console.log('🔄 后台重试MCP初始化...')
                                await initializeMCPSystem()
                                console.log('✓ 后台MCP初始化成功')
                            } catch (retryError) {
                                console.warn('⚠️  后台MCP初始化重试失败:', retryError instanceof Error ? retryError.message : retryError)
                            }
                        }, 5000)
                    }
                } else {
                    console.log('⚠️  MCP 系统初始化完成但未完全就绪')
                    console.log('详细状态:', {
                        configLoaded: status.configLoaded,
                        serversConnected: status.serversConnected,
                        toolsLoaded: status.toolsLoaded,
                        keywordsMapped: status.keywordsMapped,
                        error: status.error
                    })
                    
                    // 启动后台重试
                    console.log('🔄 将在5秒后启动后台重试...')
                    setTimeout(async () => {
                        try {
                            console.log('🔄 后台重试MCP初始化...')
                            const retryStatus = await initializeMCPSystem()
                            if (retryStatus.ready) {
                                console.log('✓ 后台MCP初始化重试成功')
                            } else {
                                console.log('⚠️  后台MCP初始化重试仍未完全成功')
                            }
                        } catch (retryError) {
                            console.warn('⚠️  后台MCP初始化重试失败:', retryError instanceof Error ? retryError.message : retryError)
                        }
                    }, 5000)
                    
                    // 即使未完全就绪，也记录为部分可用
                    console.log('系统将以降级模式运行，部分功能可能不可用')
                }
            } catch (mcpError) {
                console.error('❌ MCP 系统初始化失败:', mcpError instanceof Error ? mcpError.message : mcpError)
                process.env.MCP_STARTUP_INITIALIZING = 'false'
                
                // 启动后台重试
                console.log('🔄 将在10秒后启动后台重试...')
                setTimeout(async () => {
                    try {
                        console.log('🔄 后台重试MCP初始化...')
                        const retryStatus = await initializeMCPSystem()
                        if (retryStatus.ready) {
                            console.log('✓ 后台MCP初始化重试成功')
                        } else {
                            console.log('⚠️  后台MCP初始化重试仍未完全成功')
                        }
                    } catch (retryError) {
                        console.warn('⚠️  后台MCP初始化重试失败:', retryError instanceof Error ? retryError.message : retryError)
                    }
                }, 10000)
            }`;

        // 替换原有的MCP初始化部分
        content = content.replace(
            /\/\/ 5\. 初始化 MCP 系统[\s\S]*?console\.log\('✅ 服务器启动完成！\\n'\)/,
            mcpInitSection + '\n\n            console.log(\'✅ 服务器启动完成！\\n\')'
        );

        fs.writeFileSync(instrumentationPath, content);
        this.fixes.push('改进了启动时序，添加了延迟和后台重试机制');
        console.log('   ✓ 启动时序修复已应用');
    }

    async addStatusPersistence() {
        console.log('2️⃣ 添加状态持久化机制...');
        
        // 创建状态持久化文件
        const statusFilePath = path.join(process.cwd(), 'src', 'utils', 'mcp-status-persistence.ts');
        
        if (fs.existsSync(statusFilePath)) {
            console.log('   ✓ 状态持久化文件已存在');
            return;
        }

        const statusPersistenceContent = `// MCP Status Persistence - 持久化MCP初始化状态

import fs from 'fs'
import path from 'path'
import { MCPInitializationStatus } from '@/services/mcp-initializer'

const STATUS_FILE_PATH = path.join(process.cwd(), '.next', 'mcp-status.json')

/**
 * MCP状态持久化管理器
 */
export class MCPStatusPersistence {
    private static instance: MCPStatusPersistence
    
    private constructor() {
        // 确保状态目录存在
        const statusDir = path.dirname(STATUS_FILE_PATH)
        if (!fs.existsSync(statusDir)) {
            fs.mkdirSync(statusDir, { recursive: true })
        }
    }
    
    public static getInstance(): MCPStatusPersistence {
        if (!MCPStatusPersistence.instance) {
            MCPStatusPersistence.instance = new MCPStatusPersistence()
        }
        return MCPStatusPersistence.instance
    }
    
    /**
     * 保存MCP状态到文件
     */
    async saveStatus(status: MCPInitializationStatus): Promise<void> {
        try {
            const statusData = {
                ...status,
                timestamp: new Date().toISOString(),
                processId: process.pid
            }
            
            fs.writeFileSync(STATUS_FILE_PATH, JSON.stringify(statusData, null, 2))
            console.log('MCP状态已保存到文件')
        } catch (error) {
            console.warn('保存MCP状态失败:', error)
        }
    }
    
    /**
     * 从文件加载MCP状态
     */
    async loadStatus(): Promise<MCPInitializationStatus | null> {
        try {
            if (!fs.existsSync(STATUS_FILE_PATH)) {
                return null
            }
            
            const statusData = JSON.parse(fs.readFileSync(STATUS_FILE_PATH, 'utf-8'))
            
            // 检查状态是否过期（超过1小时）
            const timestamp = new Date(statusData.timestamp)
            const now = new Date()
            const ageInMinutes = (now.getTime() - timestamp.getTime()) / (1000 * 60)
            
            if (ageInMinutes > 60) {
                console.log('MCP状态文件已过期，忽略')
                return null
            }
            
            // 移除额外的字段
            delete statusData.timestamp
            delete statusData.processId
            
            console.log('从文件加载MCP状态成功')
            return statusData as MCPInitializationStatus
        } catch (error) {
            console.warn('加载MCP状态失败:', error)
            return null
        }
    }
    
    /**
     * 清除状态文件
     */
    async clearStatus(): Promise<void> {
        try {
            if (fs.existsSync(STATUS_FILE_PATH)) {
                fs.unlinkSync(STATUS_FILE_PATH)
                console.log('MCP状态文件已清除')
            }
        } catch (error) {
            console.warn('清除MCP状态文件失败:', error)
        }
    }
    
    /**
     * 检查是否有有效的持久化状态
     */
    hasValidStatus(): boolean {
        try {
            if (!fs.existsSync(STATUS_FILE_PATH)) {
                return false
            }
            
            const statusData = JSON.parse(fs.readFileSync(STATUS_FILE_PATH, 'utf-8'))
            const timestamp = new Date(statusData.timestamp)
            const now = new Date()
            const ageInMinutes = (now.getTime() - timestamp.getTime()) / (1000 * 60)
            
            return ageInMinutes <= 60 && statusData.ready === true
        } catch (error) {
            return false
        }
    }
}

export const getMCPStatusPersistence = () => MCPStatusPersistence.getInstance()
`;

        fs.writeFileSync(statusFilePath, statusPersistenceContent);
        this.fixes.push('添加了MCP状态持久化机制');
        console.log('   ✓ 状态持久化文件已创建');
    }

    async improveRetryMechanism() {
        console.log('3️⃣ 改进重试机制...');
        
        // 创建重试配置文件
        const retryConfigPath = path.join(process.cwd(), 'config', 'mcp-retry.json');
        
        if (fs.existsSync(retryConfigPath)) {
            console.log('   ✓ 重试配置文件已存在');
            return;
        }

        const retryConfig = {
            "description": "MCP初始化重试配置",
            "startup": {
                "initialDelay": 2000,
                "maxRetries": 3,
                "retryDelay": 5000,
                "backoffMultiplier": 1.5
            },
            "httpServers": {
                "connectionTimeout": 30000,
                "maxRetries": 5,
                "retryDelay": 2000,
                "backoffMultiplier": 2.0
            },
            "toolLoading": {
                "maxRetries": 3,
                "retryDelay": 1000,
                "timeout": 15000
            },
            "keywordMapping": {
                "maxRetries": 2,
                "retryDelay": 3000,
                "timeout": 20000
            }
        };

        fs.writeFileSync(retryConfigPath, JSON.stringify(retryConfig, null, 2));
        this.fixes.push('创建了MCP重试配置文件');
        console.log('   ✓ 重试配置文件已创建');
    }

    async addInitializationCheckpoints() {
        console.log('4️⃣ 添加初始化检查点...');
        
        // 创建初始化检查点脚本
        const checkpointScriptPath = path.join(process.cwd(), 'scripts', 'mcp-initialization-checkpoint.js');
        
        if (fs.existsSync(checkpointScriptPath)) {
            console.log('   ✓ 初始化检查点脚本已存在');
            return;
        }

        const checkpointScript = `#!/usr/bin/env node
/**
 * MCP初始化检查点脚本
 * 用于验证和修复MCP初始化状态
 */

async function runCheckpoint() {
    console.log('🔍 运行MCP初始化检查点...');
    
    try {
        // 检查数据库连接
        console.log('1. 检查数据库连接...');
        const { getDatabaseService } = await import('../src/services/database');
        const dbService = getDatabaseService();
        
        if (!dbService.isInitialized()) {
            console.log('   数据库未初始化，正在初始化...');
            await dbService.initialize();
        }
        console.log('   ✓ 数据库连接正常');
        
        // 检查MCP配置
        console.log('2. 检查MCP配置...');
        const { getConfigLoader } = await import('../src/services/config');
        const configLoader = getConfigLoader();
        await configLoader.loadConfig();
        
        const serverConfigs = configLoader.getAllMCPServerConfigs();
        console.log(\`   ✓ 找到 \${Object.keys(serverConfigs).length} 个MCP服务器配置\`);
        
        // 检查MCP系统状态
        console.log('3. 检查MCP系统状态...');
        const { getMCPInitializer } = await import('../src/services/mcp-initializer');
        const initializer = getMCPInitializer();
        const status = initializer.getStatus();
        
        console.log('   当前状态:', {
            configLoaded: status.configLoaded,
            serversConnected: status.serversConnected,
            toolsLoaded: status.toolsLoaded,
            keywordsMapped: status.keywordsMapped,
            ready: status.ready
        });
        
        // 如果系统未就绪，尝试重新初始化
        if (!status.ready) {
            console.log('4. 系统未就绪，尝试重新初始化...');
            const newStatus = await initializer.initialize(true);
            
            if (newStatus.ready) {
                console.log('   ✓ 重新初始化成功');
            } else {
                console.log('   ⚠️  重新初始化未完全成功');
                console.log('   详细信息:', newStatus);
            }
        } else {
            console.log('   ✓ MCP系统已就绪');
        }
        
        console.log('\\n✅ 检查点完成');
        
    } catch (error) {
        console.error('❌ 检查点执行失败:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    runCheckpoint().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { runCheckpoint };
`;

        fs.writeFileSync(checkpointScriptPath, checkpointScript);
        this.fixes.push('创建了MCP初始化检查点脚本');
        console.log('   ✓ 初始化检查点脚本已创建');
        
        // 更新package.json添加新的脚本命令
        const packageJsonPath = path.join(process.cwd(), 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
            
            if (!packageJson.scripts['mcp:checkpoint']) {
                packageJson.scripts['mcp:checkpoint'] = 'node scripts/mcp-initialization-checkpoint.js';
                packageJson.scripts['mcp:fix'] = 'node scripts/fix-mcp-initialization.js';
                
                fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
                this.fixes.push('添加了新的npm脚本命令');
                console.log('   ✓ 已添加npm脚本命令: mcp:checkpoint, mcp:fix');
            }
        }
    }
}

// 运行修复
async function main() {
    const fixer = new MCPInitializationFixer();
    await fixer.applyFixes();
}

if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { MCPInitializationFixer };