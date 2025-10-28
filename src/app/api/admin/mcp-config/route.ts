import { NextRequest, NextResponse } from 'next/server'
import { getDatabaseService } from '@/services/database'

// 获取所有MCP配置
export async function GET() {
  try {
    const db = getDatabaseService()
    await db.initialize()
    const result = await db.query(`
      SELECT id, name, command, args, env, disabled, auto_approve, 
             created_at, updated_at
      FROM mcp_configs 
      ORDER BY created_at DESC
    `)

    const configs = result.rows.map((config: any) => ({
      ...config,
      args: config.args || [],
      env: config.env || {},
      auto_approve: config.auto_approve || []
    }))

    return NextResponse.json({ 
      success: true, 
      configs 
    })
  } catch (error) {
    console.error('Failed to fetch MCP configs:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch MCP configs' },
      { status: 500 }
    )
  }
}

// 创建新的MCP配置
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name,
      command,
      args,
      env,
      disabled,
      auto_approve
    } = body

    // 验证必填字段
    if (!name || !command) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const db = getDatabaseService()
    await db.initialize()
    const result = await db.query(`
      INSERT INTO mcp_configs (
        name, command, args, env, disabled, auto_approve
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, command, disabled
    `, [
      name,
      command,
      JSON.stringify(args || []),
      JSON.stringify(env || {}),
      disabled || false,
      JSON.stringify(auto_approve || [])
    ])

    return NextResponse.json({
      success: true,
      config: result.rows[0]
    })
  } catch (error) {
    console.error('Failed to create MCP config:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create MCP config' },
      { status: 500 }
    )
  }
}

// 更新MCP配置
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      id,
      name,
      command,
      args,
      env,
      disabled,
      auto_approve
    } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing config ID' },
        { status: 400 }
      )
    }

    // 构建更新查询
    const updateFields = []
    const values = []
    let paramIndex = 1

    if (name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`)
      values.push(name)
    }
    if (command !== undefined) {
      updateFields.push(`command = $${paramIndex++}`)
      values.push(command)
    }
    if (args !== undefined) {
      updateFields.push(`args = $${paramIndex++}`)
      values.push(JSON.stringify(args))
    }
    if (env !== undefined) {
      updateFields.push(`env = $${paramIndex++}`)
      values.push(JSON.stringify(env))
    }
    if (disabled !== undefined) {
      updateFields.push(`disabled = $${paramIndex++}`)
      values.push(disabled)
    }
    if (auto_approve !== undefined) {
      updateFields.push(`auto_approve = $${paramIndex++}`)
      values.push(JSON.stringify(auto_approve))
    }

    updateFields.push(`updated_at = NOW()`)
    values.push(id)

    const db = getDatabaseService()
    await db.initialize()
    const result = await db.query(`
      UPDATE mcp_configs 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, name, command, disabled
    `, values)

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Config not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      config: result.rows[0]
    })
  } catch (error) {
    console.error('Failed to update MCP config:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update MCP config' },
      { status: 500 }
    )
  }
}