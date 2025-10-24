// 检查24点游戏关键词映射

// 使用动态导入来处理ES模块
async function importDatabaseService() {
  try {
    const { getDatabaseService } = await import('../src/services/database.ts');
    return getDatabaseService;
  } catch (error) {
    console.error('导入数据库服务失败:', error);
    return null;
  }
}

async function checkKeywords() {
  try {
    const getDatabaseService = await importDatabaseService();
    if (!getDatabaseService) {
      console.log('❌ 无法导入数据库服务');
      return;
    }
    
    const dbService = getDatabaseService();
    const client = await dbService.getClient();
    
    if (!client) {
      console.log('❌ 数据库连接失败');
      return;
    }
    
    try {
      // 检查24点游戏相关的关键词映射
      const result = await client.query(`
        SELECT tool_name, keyword, confidence 
        FROM tool_keyword_mappings 
        WHERE tool_name = 'solve_24_point_game' 
        OR keyword LIKE '%24%'
        ORDER BY tool_name, confidence DESC
      `);
      
      console.log('=== 24点游戏关键词映射 ===');
      if (result.rows.length === 0) {
        console.log('❌ 没有找到24点游戏的关键词映射');
      } else {
        result.rows.forEach(row => {
          console.log(`工具: ${row.tool_name}, 关键词: ${row.keyword}, 置信度: ${row.confidence}`);
        });
      }
      
      // 检查所有工具的关键词映射
      const allResult = await client.query(`
        SELECT tool_name, COUNT(*) as keyword_count
        FROM tool_keyword_mappings 
        GROUP BY tool_name
        ORDER BY keyword_count DESC
      `);
      
      console.log('\n=== 所有工具关键词统计 ===');
      allResult.rows.forEach(row => {
        console.log(`${row.tool_name}: ${row.keyword_count} 个关键词`);
      });
      
      // 测试用户输入的匹配
      const testInput = '如何从 8、8、4、13 从简单的加减乘除运算得到 24';
      console.log(`\n=== 测试输入匹配: "${testInput}" ===`);
      
      const matchResult = await client.query(`
        SELECT DISTINCT t.name as tool_name, 
               array_agg(DISTINCT tkm.keyword) as keywords,
               COUNT(CASE WHEN $1 ILIKE '%' || tkm.keyword || '%' THEN 1 END) as match_count
        FROM mcp_tools t
        JOIN tool_keyword_mappings tkm ON t.name = tkm.tool_name
        WHERE $1 ILIKE '%' || tkm.keyword || '%'
        GROUP BY t.name
        ORDER BY match_count DESC
      `, [testInput.toLowerCase()]);
      
      if (matchResult.rows.length === 0) {
        console.log('❌ 没有找到匹配的工具');
      } else {
        matchResult.rows.forEach(row => {
          console.log(`工具: ${row.tool_name}, 匹配关键词: ${row.keywords.join(', ')}, 匹配数: ${row.match_count}`);
        });
      }
      
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('检查失败:', error);
  }
}

checkKeywords();