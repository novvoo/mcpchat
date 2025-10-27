import { NextRequest, NextResponse } from 'next/server'
import { getDatabaseService } from '@/services/database'

export async function GET() {
  try {
    const dbService = getDatabaseService()
    const client = await dbService.getClient()
    
    if (!client) {
      return NextResponse.json({ 
        error: '数据库连接失败',
        templates: [] 
      }, { status: 500 })
    }

    try {
      const result = await client.query(`
        SELECT 
          id,
          template_name,
          tool_name,
          category,
          difficulty,
          title_template,
          description_template,
          parameter_generators,
          expected_solution_template,
          keywords_template,
          generation_rules,
          is_active,
          priority,
          created_at,
          updated_at
        FROM sample_problem_templates 
        ORDER BY priority DESC, template_name
      `)

      const templates = result.rows.map(row => ({
        ...row,
        parameter_generators: typeof row.parameter_generators === 'string' 
          ? JSON.parse(row.parameter_generators) 
          : row.parameter_generators,
        expected_solution_template: typeof row.expected_solution_template === 'string'
          ? JSON.parse(row.expected_solution_template)
          : row.expected_solution_template,
        generation_rules: typeof row.generation_rules === 'string'
          ? JSON.parse(row.generation_rules)
          : row.generation_rules
      }))

      return NextResponse.json({
        success: true,
        templates,
        count: templates.length
      })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('获取问题模板失败:', error)
    return NextResponse.json({ 
      error: '获取问题模板失败',
      templates: [] 
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      template_name,
      tool_name,
      category,
      difficulty,
      title_template,
      description_template,
      parameter_generators,
      expected_solution_template,
      keywords_template,
      generation_rules,
      is_active = true,
      priority = 1
    } = body

    if (!template_name || !tool_name) {
      return NextResponse.json({ 
        error: '模板名称和工具名称是必需的' 
      }, { status: 400 })
    }

    const dbService = getDatabaseService()
    const client = await dbService.getClient()
    
    if (!client) {
      return NextResponse.json({ 
        error: '数据库连接失败' 
      }, { status: 500 })
    }

    try {
      const result = await client.query(`
        INSERT INTO sample_problem_templates (
          template_name, tool_name, category, difficulty,
          title_template, description_template, parameter_generators,
          expected_solution_template, keywords_template, generation_rules,
          is_active, priority
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [
        template_name, tool_name, category, difficulty,
        title_template, description_template, 
        JSON.stringify(parameter_generators),
        JSON.stringify(expected_solution_template),
        keywords_template, JSON.stringify(generation_rules),
        is_active, priority
      ])

      return NextResponse.json({
        success: true,
        template: result.rows[0],
        message: '问题模板创建成功'
      })
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('创建问题模板失败:', error)
    return NextResponse.json({ 
      error: '创建问题模板失败' 
    }, { status: 500 })
  }
}