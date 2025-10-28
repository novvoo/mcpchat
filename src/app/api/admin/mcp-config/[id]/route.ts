import { NextRequest, NextResponse } from 'next/server'
import { getDatabaseService } from '@/services/database'

// 删除MCP配置
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params
    const id = parseInt(idParam)
    
    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid config ID' },
        { status: 400 }
      )
    }

    const db = getDatabaseService()
    await db.initialize()
    
    // 删除配置
    const result = await db.query(
      'DELETE FROM mcp_configs WHERE id = $1 RETURNING id, name',
      [id]
    )

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Config not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      deleted: result.rows[0]
    })
  } catch (error) {
    console.error('Failed to delete MCP config:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete MCP config' },
      { status: 500 }
    )
  }
}

// 获取单个MCP配置
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params
    const id = parseInt(idParam)
    
    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid config ID' },
        { status: 400 }
      )
    }

    const db = getDatabaseService()
    await db.initialize()
    
    const result = await db.query(`
      SELECT id, name, command, args, env, disabled, auto_approve, 
             created_at, updated_at
      FROM mcp_configs 
      WHERE id = $1
    `, [id])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Config not found' },
        { status: 404 }
      )
    }

    const config = {
      ...result.rows[0],
      args: result.rows[0].args || [],
      env: result.rows[0].env || {},
      auto_approve: result.rows[0].auto_approve || []
    }

    return NextResponse.json({ 
      success: true, 
      config 
    })
  } catch (error) {
    console.error('Failed to fetch MCP config:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch MCP config' },
      { status: 500 }
    )
  }
}