import { NextRequest, NextResponse } from 'next/server'
import { getDatabaseService } from '@/services/database'

// 删除LLM配置
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

    // 检查是否是活跃配置
    const checkResult = await db.query(
      'SELECT is_active FROM llm_configs WHERE id = $1',
      [id]
    )

    if (checkResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Config not found' },
        { status: 404 }
      )
    }

    if (checkResult.rows[0].is_active) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete active config' },
        { status: 400 }
      )
    }

    // 删除配置
    const result = await db.query(
      'DELETE FROM llm_configs WHERE id = $1 RETURNING id, name',
      [id]
    )

    return NextResponse.json({
      success: true,
      deleted: result.rows[0]
    })
  } catch (error) {
    console.error('Failed to delete LLM config:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete LLM config' },
      { status: 500 }
    )
  }
}

// 获取单个LLM配置
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
      SELECT id, name, provider, model, api_key, base_url, temperature, 
             max_tokens, timeout, is_active, created_at, updated_at
      FROM llm_configs 
      WHERE id = $1
    `, [id])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Config not found' },
        { status: 404 }
      )
    }

    // 隐藏API密钥的敏感信息
    const config = {
      ...result.rows[0],
      api_key: result.rows[0].api_key ? '***' + result.rows[0].api_key.slice(-4) : ''
    }

    return NextResponse.json({ 
      success: true, 
      config 
    })
  } catch (error) {
    console.error('Failed to fetch LLM config:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch LLM config' },
      { status: 500 }
    )
  }
}