import { NextRequest, NextResponse } from 'next/server'
import { getDatabaseService } from '@/services/database'

interface LLMConfig {
  id: number
  name: string
  provider: string
  model: string
  api_key: string
  base_url?: string
  temperature: number
  max_tokens: number
  timeout: number
  is_active: boolean
  created_at: string
  updated_at: string
}

// 获取所有LLM配置
export async function GET() {
  try {
    const db = getDatabaseService()
    await db.initialize()

    const result = await db.query(`
      SELECT id, name, provider, model, api_key, base_url, temperature, 
             max_tokens, timeout, is_active, created_at, updated_at
      FROM llm_configs 
      ORDER BY created_at DESC
    `)

    // 隐藏API密钥的敏感信息
    const configs = result.rows.map((config: LLMConfig) => ({
      ...config,
      api_key: config.api_key ? '***' + config.api_key.slice(-4) : ''
    }))

    return NextResponse.json({
      success: true,
      configs
    })
  } catch (error) {
    console.error('Failed to fetch LLM configs:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch LLM configs' },
      { status: 500 }
    )
  }
}

// 创建新的LLM配置
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name,
      provider,
      model,
      api_key,
      base_url,
      temperature,
      max_tokens,
      timeout,
      is_active
    } = body

    // 验证必填字段
    if (!name || !provider || !model || !api_key) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const db = getDatabaseService()
    await db.initialize()

    // 如果设置为活跃配置，先将其他配置设为非活跃
    if (is_active) {
      await db.query('UPDATE llm_configs SET is_active = false')
    }

    const result = await db.query(`
      INSERT INTO llm_configs (
        name, provider, model, api_key, base_url, temperature, 
        max_tokens, timeout, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, name, provider, model, is_active
    `, [
      name,
      provider,
      model,
      api_key,
      base_url || null,
      temperature || 0.7,
      max_tokens || 2000,
      timeout || 30000,
      is_active || false
    ])

    return NextResponse.json({
      success: true,
      config: result.rows[0]
    })
  } catch (error) {
    console.error('Failed to create LLM config:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create LLM config' },
      { status: 500 }
    )
  }
}

// 更新LLM配置
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      id,
      name,
      provider,
      model,
      api_key,
      base_url,
      temperature,
      max_tokens,
      timeout,
      is_active
    } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing config ID' },
        { status: 400 }
      )
    }

    const db = getDatabaseService()
    await db.initialize()

    // 如果设置为活跃配置，先将其他配置设为非活跃
    if (is_active) {
      await db.query('UPDATE llm_configs SET is_active = false WHERE id != $1', [id])
    }

    // 构建更新查询
    const updateFields = []
    const values = []
    let paramIndex = 1

    if (name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`)
      values.push(name)
    }
    if (provider !== undefined) {
      updateFields.push(`provider = $${paramIndex++}`)
      values.push(provider)
    }
    if (model !== undefined) {
      updateFields.push(`model = $${paramIndex++}`)
      values.push(model)
    }
    if (api_key !== undefined && !api_key.startsWith('***')) {
      updateFields.push(`api_key = $${paramIndex++}`)
      values.push(api_key)
    }
    if (base_url !== undefined) {
      updateFields.push(`base_url = $${paramIndex++}`)
      values.push(base_url || null)
    }
    if (temperature !== undefined) {
      updateFields.push(`temperature = $${paramIndex++}`)
      values.push(temperature)
    }
    if (max_tokens !== undefined) {
      updateFields.push(`max_tokens = $${paramIndex++}`)
      values.push(max_tokens)
    }
    if (timeout !== undefined) {
      updateFields.push(`timeout = $${paramIndex++}`)
      values.push(timeout)
    }
    if (is_active !== undefined) {
      updateFields.push(`is_active = $${paramIndex++}`)
      values.push(is_active)
    }

    updateFields.push(`updated_at = NOW()`)
    values.push(id)

    const result = await db.query(`
      UPDATE llm_configs 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, name, provider, model, is_active
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
    console.error('Failed to update LLM config:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update LLM config' },
      { status: 500 }
    )
  }
}