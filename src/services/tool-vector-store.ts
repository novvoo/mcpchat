// Tool Vector Store - Manage tool embeddings and semantic search

import { Tool } from '@/types'
import { getDatabaseService } from './database'
import { getEmbeddingService } from './embedding-service'
import pgvector from 'pgvector/pg'

export interface ToolSearchResult {
    tool: Tool
    similarity: number
}

/**
 * Tool Vector Store - Semantic search for MCP tools
 */
export class ToolVectorStore {
    private static instance: ToolVectorStore
    private initialized: boolean = false

    private constructor() { }

    public static getInstance(): ToolVectorStore {
        if (!ToolVectorStore.instance) {
            ToolVectorStore.instance = new ToolVectorStore()
        }
        return ToolVectorStore.instance
    }

    /**
     * Initialize vector store
     */
    async initialize(): Promise<void> {
        if (this.initialized) return

        try {
            const dbService = getDatabaseService()
            await dbService.initialize()

            const embeddingService = getEmbeddingService()
            await embeddingService.initialize()

            this.initialized = true
            console.log('Tool vector store initialized')
        } catch (error) {
            console.error('Failed to initialize tool vector store:', error)
            // Don't throw - allow fallback to non-vector search
        }
    }

    /**
     * Index a tool (store with embedding)
     */
    async indexTool(tool: Tool, serverName: string): Promise<void> {
        const dbService = getDatabaseService()

        if (!dbService.isVectorSearchEnabled()) {
            return // Skip if vector search not available
        }

        try {
            const embeddingService = getEmbeddingService()
            const embedding = await embeddingService.generateToolEmbedding(
                tool.name,
                tool.description
            )

            const client = await dbService.getClient()
            if (!client) return

            try {
                await client.query(
                    `INSERT INTO mcp_tools (name, description, input_schema, server_name, embedding, metadata)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (name) 
           DO UPDATE SET 
             description = EXCLUDED.description,
             input_schema = EXCLUDED.input_schema,
             server_name = EXCLUDED.server_name,
             embedding = EXCLUDED.embedding,
             metadata = EXCLUDED.metadata,
             updated_at = CURRENT_TIMESTAMP`,
                    [
                        tool.name,
                        tool.description,
                        JSON.stringify(tool.inputSchema),
                        serverName,
                        pgvector.toSql(embedding),
                        JSON.stringify({ indexed_at: new Date().toISOString() })
                    ]
                )

                console.log(`Tool ${tool.name} indexed successfully`)
            } finally {
                client.release()
            }
        } catch (error) {
            console.error(`Failed to index tool ${tool.name}:`, error)
            // Don't throw - allow system to continue
        }
    }

    /**
     * Index multiple tools (batch)
     */
    async indexTools(tools: Tool[], serverName: string): Promise<void> {
        console.log(`Indexing ${tools.length} tools from server ${serverName}...`)

        const indexPromises = tools.map(tool => this.indexTool(tool, serverName))
        await Promise.allSettled(indexPromises)

        console.log(`Finished indexing tools from ${serverName}`)
    }

    /**
     * Search for relevant tools using semantic similarity
     */
    async searchTools(query: string, maxResults: number = 5): Promise<ToolSearchResult[]> {
        const dbService = getDatabaseService()

        if (!dbService.isVectorSearchEnabled()) {
            console.log('Vector search not available, returning empty results')
            return []
        }

        try {
            const embeddingService = getEmbeddingService()
            const queryEmbedding = await embeddingService.generateEmbedding(query)

            const vectorConfig = dbService.getVectorConfig()
            const threshold = vectorConfig?.similarityThreshold || 0.7

            const client = await dbService.getClient()
            if (!client) return []

            try {
                const result = await client.query(
                    `SELECT 
             name,
             description,
             input_schema,
             server_name,
             1 - (embedding <=> $1) as similarity
           FROM mcp_tools
           WHERE 1 - (embedding <=> $1) > $2
           ORDER BY embedding <=> $1
           LIMIT $3`,
                    [pgvector.toSql(queryEmbedding), threshold, maxResults]
                )

                return result.rows.map((row: any) => ({
                    tool: {
                        name: row.name,
                        description: row.description,
                        inputSchema: row.input_schema
                    },
                    similarity: row.similarity
                }))
            } finally {
                client.release()
            }
        } catch (error) {
            console.error('Failed to search tools:', error)
            return []
        }
    }

    /**
     * Get tool by name
     */
    async getTool(toolName: string): Promise<Tool | null> {
        const dbService = getDatabaseService()

        if (!dbService.isVectorSearchEnabled()) {
            return null
        }

        try {
            const client = await dbService.getClient()
            if (!client) return null

            try {
                const result = await client.query(
                    'SELECT name, description, input_schema FROM mcp_tools WHERE name = $1',
                    [toolName]
                )

                if (result.rows.length === 0) {
                    return null
                }

                const row = result.rows[0]
                return {
                    name: row.name,
                    description: row.description,
                    inputSchema: row.input_schema
                }
            } finally {
                client.release()
            }
        } catch (error) {
            console.error(`Failed to get tool ${toolName}:`, error)
            return null
        }
    }

    /**
     * Delete tool from index
     */
    async deleteTool(toolName: string): Promise<void> {
        const dbService = getDatabaseService()

        if (!dbService.isVectorSearchEnabled()) {
            return
        }

        try {
            await dbService.query('DELETE FROM mcp_tools WHERE name = $1', [toolName])
            console.log(`Tool ${toolName} deleted from index`)
        } catch (error) {
            console.error(`Failed to delete tool ${toolName}:`, error)
        }
    }

    /**
     * Clear all tools from a server
     */
    async clearServerTools(serverName: string): Promise<void> {
        const dbService = getDatabaseService()

        if (!dbService.isVectorSearchEnabled()) {
            return
        }

        try {
            await dbService.query('DELETE FROM mcp_tools WHERE server_name = $1', [serverName])
            console.log(`All tools from server ${serverName} cleared`)
        } catch (error) {
            console.error(`Failed to clear tools from ${serverName}:`, error)
        }
    }

    /**
     * Get statistics
     */
    async getStats(): Promise<{
        totalTools: number
        toolsByServer: Record<string, number>
    }> {
        const dbService = getDatabaseService()

        if (!dbService.isVectorSearchEnabled()) {
            return { totalTools: 0, toolsByServer: {} }
        }

        try {
            const client = await dbService.getClient()
            if (!client) return { totalTools: 0, toolsByServer: {} }

            try {
                const totalResult = await client.query('SELECT COUNT(*) as count FROM mcp_tools')
                const serverResult = await client.query(
                    'SELECT server_name, COUNT(*) as count FROM mcp_tools GROUP BY server_name'
                )

                const toolsByServer: Record<string, number> = {}
                for (const row of serverResult.rows) {
                    toolsByServer[row.server_name] = parseInt(row.count)
                }

                return {
                    totalTools: parseInt(totalResult.rows[0].count),
                    toolsByServer
                }
            } finally {
                client.release()
            }
        } catch (error) {
            console.error('Failed to get stats:', error)
            return { totalTools: 0, toolsByServer: {} }
        }
    }

    /**
     * Check if vector store is ready
     */
    isReady(): boolean {
        const dbService = getDatabaseService()
        return this.initialized && dbService.isVectorSearchEnabled()
    }
}

/**
 * Convenience function
 */
export const getToolVectorStore = () => ToolVectorStore.getInstance()
