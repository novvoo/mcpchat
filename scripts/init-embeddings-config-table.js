// Initialize embeddings_config table and sync configuration
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function initEmbeddingsConfigTable() {
    console.log('🚀 初始化 embeddings_config 表...\n');

    // 加载数据库配置
    const dbConfigPath = path.join(process.cwd(), 'config', 'database.json');
    if (!fs.existsSync(dbConfigPath)) {
        console.error('❌ 数据库配置文件不存在:', dbConfigPath);
        process.exit(1);
    }

    const configData = JSON.parse(fs.readFileSync(dbConfigPath, 'utf-8'));
    const dbConfig = configData.postgresql;

    const pool = new Pool({
        host: dbConfig.host,
        port: dbConfig.port,
        database: dbConfig.database,
        user: dbConfig.user,
        password: dbConfig.password,
        ssl: dbConfig.ssl ? { rejectUnauthorized: false } : false
    });

    const client = await pool.connect();

    try {
        console.log('✓ 连接数据库成功\n');

        // 1. 创建 embeddings_config 表
        console.log('1️⃣ 创建 embeddings_config 表...');
        await client.query(`
            CREATE TABLE IF NOT EXISTS embeddings_config (
                id SERIAL PRIMARY KEY,
                provider VARCHAR(100) NOT NULL,
                model VARCHAR(255) NOT NULL,
                dimensions INTEGER NOT NULL,
                endpoint VARCHAR(255) NOT NULL,
                api_key_configured BOOLEAN DEFAULT false,
                base_url TEXT,
                batch_size INTEGER DEFAULT 100,
                is_available BOOLEAN DEFAULT false,
                last_checked TIMESTAMP,
                last_success TIMESTAMP,
                last_failure TIMESTAMP,
                failure_count INTEGER DEFAULT 0,
                success_count INTEGER DEFAULT 0,
                fallback_enabled BOOLEAN DEFAULT true,
                fallback_type VARCHAR(50) DEFAULT 'mock',
                metadata JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✓ embeddings_config 表创建成功\n');

        // 2. 创建索引
        console.log('2️⃣ 创建索引...');
        await client.query(`
            CREATE INDEX IF NOT EXISTS embeddings_config_provider_idx 
            ON embeddings_config (provider)
        `);
        console.log('✓ 索引创建成功\n');

        // 3. 同步配置文件到数据库
        console.log('3️⃣ 同步 embeddings 配置到数据库...');
        const embeddingsConfigPath = path.join(process.cwd(), 'config', 'embeddings.json');
        
        if (!fs.existsSync(embeddingsConfigPath)) {
            console.warn('⚠️  embeddings.json 不存在，创建默认配置记录');
            await client.query(`
                INSERT INTO embeddings_config (
                    provider, model, dimensions, endpoint, api_key_configured,
                    base_url, batch_size, is_available, fallback_enabled, fallback_type
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT DO NOTHING
            `, [
                'openai',
                'text-embedding-ada-002',
                1536,
                '/embeddings',
                false,
                null,
                100,
                false,
                true,
                'mock'
            ]);
        } else {
            const embeddingsConfig = JSON.parse(fs.readFileSync(embeddingsConfigPath, 'utf-8'));
            
            // 获取 LLM 配置
            const baseUrl = process.env.LLM_URL || null;
            const apiKeyConfigured = !!(process.env.LLM_API_KEY);

            // 检查是否已有记录
            const existing = await client.query('SELECT id FROM embeddings_config LIMIT 1');
            
            if (existing.rows.length > 0) {
                // 更新现有记录
                await client.query(`
                    UPDATE embeddings_config 
                    SET provider = $1,
                        model = $2,
                        dimensions = $3,
                        endpoint = $4,
                        api_key_configured = $5,
                        base_url = $6,
                        batch_size = $7,
                        fallback_enabled = $8,
                        fallback_type = $9,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $10
                `, [
                    embeddingsConfig.provider || 'openai',
                    embeddingsConfig.model || 'text-embedding-ada-002',
                    embeddingsConfig.dimensions || 1536,
                    embeddingsConfig.endpoint || '/embeddings',
                    apiKeyConfigured,
                    baseUrl,
                    embeddingsConfig.batchSize || 100,
                    embeddingsConfig.fallback?.enabled ?? true,
                    embeddingsConfig.fallback?.type || 'mock',
                    existing.rows[0].id
                ]);
                console.log('✓ 配置已更新');
            } else {
                // 插入新记录
                await client.query(`
                    INSERT INTO embeddings_config (
                        provider, model, dimensions, endpoint, api_key_configured,
                        base_url, batch_size, is_available, fallback_enabled, fallback_type
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                `, [
                    embeddingsConfig.provider || 'openai',
                    embeddingsConfig.model || 'text-embedding-ada-002',
                    embeddingsConfig.dimensions || 1536,
                    embeddingsConfig.endpoint || '/embeddings',
                    apiKeyConfigured,
                    baseUrl,
                    embeddingsConfig.batchSize || 100,
                    false,
                    embeddingsConfig.fallback?.enabled ?? true,
                    embeddingsConfig.fallback?.type || 'mock'
                ]);
                console.log('✓ 配置已插入');
            }
        }
        console.log('✓ 配置同步完成\n');

        // 4. 测试 embeddings 可用性
        console.log('4️⃣ 测试 embeddings API 可用性...');
        const config = await client.query('SELECT * FROM embeddings_config ORDER BY id DESC LIMIT 1');
        
        if (config.rows.length > 0 && config.rows[0].base_url) {
            const embConfig = config.rows[0];
            const baseUrl = embConfig.base_url.replace('/v1', '') + '/v1';
            const url = `${baseUrl}${embConfig.endpoint}`;
            
            const headers = {
                'Content-Type': 'application/json'
            };
            
            if (embConfig.api_key_configured && process.env.LLM_API_KEY) {
                headers['Authorization'] = `Bearer ${process.env.LLM_API_KEY}`;
            }

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);

                const response = await fetch(url, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        input: 'test',
                        model: embConfig.model
                    }),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);
                const responseText = await response.text();
                
                if (response.ok && responseText.trim().startsWith('{')) {
                    const data = JSON.parse(responseText);
                    if (data.data && data.data[0] && data.data[0].embedding) {
                        console.log('✓ Embeddings API 可用');
                        await client.query(`
                            UPDATE embeddings_config 
                            SET is_available = true,
                                last_checked = CURRENT_TIMESTAMP,
                                last_success = CURRENT_TIMESTAMP,
                                updated_at = CURRENT_TIMESTAMP
                            WHERE id = $1
                        `, [embConfig.id]);
                    } else {
                        console.warn('⚠️  Embeddings API 返回格式异常');
                        await client.query(`
                            UPDATE embeddings_config 
                            SET is_available = false,
                                last_checked = CURRENT_TIMESTAMP,
                                last_failure = CURRENT_TIMESTAMP,
                                metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{error}', '"Unexpected response format"'),
                                updated_at = CURRENT_TIMESTAMP
                            WHERE id = $1
                        `, [embConfig.id]);
                    }
                } else {
                    console.warn('⚠️  Embeddings API 不可用或返回非 JSON');
                    await client.query(`
                        UPDATE embeddings_config 
                        SET is_available = false,
                            last_checked = CURRENT_TIMESTAMP,
                            last_failure = CURRENT_TIMESTAMP,
                            metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{error}', '"Non-JSON response"'),
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = $1
                    `, [embConfig.id]);
                }
            } catch (error) {
                console.warn('⚠️  Embeddings API 测试失败:', error.message);
                await client.query(`
                    UPDATE embeddings_config 
                    SET is_available = false,
                        last_checked = CURRENT_TIMESTAMP,
                        last_failure = CURRENT_TIMESTAMP,
                        metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{error}', $2),
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                `, [embConfig.id, JSON.stringify(error.message)]);
            }
        } else {
            console.warn('⚠️  无法测试：缺少配置或 base_url');
        }

        // 5. 显示最终状态
        console.log('\n5️⃣ 当前配置状态:');
        const finalConfig = await client.query('SELECT * FROM embeddings_config ORDER BY id DESC LIMIT 1');
        if (finalConfig.rows.length > 0) {
            const cfg = finalConfig.rows[0];
            console.log(`  Provider: ${cfg.provider}`);
            console.log(`  Model: ${cfg.model}`);
            console.log(`  Is Available: ${cfg.is_available ? '✓ Yes' : '✗ No'}`);
            console.log(`  Last Checked: ${cfg.last_checked || 'Never'}`);
            console.log(`  Fallback Enabled: ${cfg.fallback_enabled ? 'Yes' : 'No'}`);
        }

        console.log('\n✅ embeddings_config 表初始化完成！');

    } catch (error) {
        console.error('\n❌ 初始化失败:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

initEmbeddingsConfigTable();
