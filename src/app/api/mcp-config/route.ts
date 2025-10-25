import { NextResponse } from 'next/server'
import { getDatabaseService } from '@/services/database'

export async function GET() {
  try {
    const dbService = getDatabaseService()
    
    // 确保数据库已初始化
    await dbService.initialize()
    
    // 从数据库读取 MCP 服务器配置
    const result = await dbService.query(`
      SELECT 
        name,
        display_name,
        transport,
        url,
        command,
        args,
        env,
        disabled,
        metadata
      FROM mcp_servers
      ORDER BY name
    `)

    const servers = result.rows

    if (!servers || servers.length === 0) {
      return NextResponse.json({ 
        mcpServers: {},
        message: 'No MCP servers configured in database'
      })
    }

    // 转换为 mcp.json 格式
    const mcpServers: Record<string, any> = {}
    
    servers.forEach((server: any) => {
      const config: any = {
        name: server.display_name || server.name,
        transport: server.transport
      }

      if (server.url) {
        config.url = server.url
      }

      if (server.command) {
        config.command = server.command
      }

      if (server.args) {
        try {
          config.args = JSON.parse(server.args)
        } catch (e) {
          config.args = server.args
        }
      }

      if (server.env) {
        try {
          config.env = JSON.parse(server.env)
        } catch (e) {
          config.env = server.env
        }
      }

      if (server.disabled) {
        config.disabled = true
      }

      mcpServers[server.name] = config
    })
    
    return NextResponse.json({ mcpServers })
  } catch (error) {
    console.error('Error reading MCP config from database:', error)
    return NextResponse.json(
      { error: 'Failed to read MCP config from database' }, 
      { status: 500 }
    )
  }
}