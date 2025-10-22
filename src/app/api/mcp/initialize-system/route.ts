import { NextRequest, NextResponse } from 'next/server'
import { getMCPInitializer } from '@/services/mcp-initializer'

/**
 * MCP系统初始化API端点
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { force = false } = body

    const initializer = getMCPInitializer()
    
    // 如果强制重新初始化或系统未就绪，则执行初始化
    let status
    if (force || !initializer.isReady()) {
      console.log('开始MCP系统初始化...')
      status = await initializer.initialize()
    } else {
      console.log('MCP系统已就绪')
      status = initializer.getStatus()
    }

    return NextResponse.json({
      success: status.ready,
      message: status.ready ? 'MCP系统初始化成功' : 'MCP系统初始化失败',
      data: {
        status,
        timestamp: new Date().toISOString()
      },
      error: status.error
    })

  } catch (error) {
    console.error('MCP系统初始化API错误:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'MCP系统初始化失败',
        error: error instanceof Error ? error.message : '未知错误',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

/**
 * 获取MCP系统状态
 */
export async function GET(request: NextRequest) {
  try {
    const initializer = getMCPInitializer()
    const systemInfo = await initializer.getSystemInfo()

    return NextResponse.json({
      success: true,
      data: {
        ...systemInfo,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('获取MCP系统状态错误:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    )
  }
}