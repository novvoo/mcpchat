const { getDatabaseService } = require('../src/services/database.ts');

async function checkInstallKeywords() {
  try {
    const db = getDatabaseService();
    
    // Initialize database connection first
    await db.initialize();
    
    const client = await db.getClient();
    
    if (!client) {
      console.error('无法连接到数据库');
      return;
    }
    
    console.log('检查install工具的关键词映射...');
    
    // 检查install工具的关键词
    const keywordResult = await client.query(
      'SELECT * FROM tool_keyword_mappings WHERE tool_name = $1', 
      ['install']
    );
    
    console.log('Install工具关键词数量:', keywordResult.rows.length);
    console.log('关键词列表:', keywordResult.rows);
    
    // 检查所有工具
    const allToolsResult = await client.query(
      'SELECT DISTINCT tool_name FROM tool_keyword_mappings ORDER BY tool_name'
    );
    
    console.log('\n所有有关键词映射的工具:');
    allToolsResult.rows.forEach(row => {
      console.log('- ' + row.tool_name);
    });
    
    client.release();
  } catch (error) {
    console.error('检查失败:', error.message);
  }
}

checkInstallKeywords();