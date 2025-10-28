// MCP Status Persistence - 持久化MCP初始化状态

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
