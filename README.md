# MCP Chat Client

An intelligent chat client that integrates MCP (Model Context Protocol) tools with LLM capabilities, featuring semantic tool search powered by PostgreSQL and pgvector.

## Features

- **MCP Tool Integration**: Connect and use MCP servers and their tools
- **Smart Routing**: Automatically selects relevant tools based on user queries
- **Vector Search**: Semantic tool discovery using pgvector for accurate tool matching
- **LLM Integration**: OpenAI-compatible API support for chat and embeddings
- **Conversation Management**: Multi-turn conversations with context preservation
- **Tool Indexing**: Automatic indexing of MCP tools for fast semantic search

## Architecture

### Core Components

- **Smart Router**: Intelligently routes queries to appropriate tools using vector search
- **MCP Manager**: Manages MCP server connections and tool discovery
- **Tool Vector Store**: Stores and searches tool embeddings using pgvector
- **Embedding Service**: Generates embeddings via LLM API
- **Database Service**: PostgreSQL connection management with pgvector support

### Technology Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with pgvector extension
- **Vector Search**: pgvector for semantic similarity search
- **Embeddings**: OpenAI-compatible embedding API
- **MCP**: Model Context Protocol for tool integration

## Prerequisites

- Node.js 18+
- PostgreSQL 12+ with pgvector extension
- OpenAI-compatible LLM API endpoint

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd mcpchat
```

2. Install dependencies:
```bash
npm install
```

3. Install PostgreSQL and pgvector:
```bash
# macOS
brew install postgresql pgvector

# Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib
# Install pgvector from source or package
```

4. Configure LLM settings:
```bash
cp config/llm.json.example config/llm.json
```

Edit `config/llm.json`:
```json
{
  "url": "https://your-llm-api.com/v1/chat/completions",
  "apiKey": "your-api-key",
  "timeout": 30000,
  "maxTokens": 2000,
  "temperature": 0.7,
  "headers": {
    "Content-Type": "application/json"
  }
}
```

5. Configure database:
```bash
cp config/database.json.example config/database.json
```

Edit `config/database.json`:
```json
{
  "postgresql": {
    "host": "localhost",
    "port": 5432,
    "database": "mcp_tools",
    "user": "your-username",
    "password": "your-password",
    "ssl": false,
    "pool": {
      "min": 2,
      "max": 10
    }
  },
  "pgvector": {
    "enabled": true,
    "similarityThreshold": 0.7,
    "maxResults": 5
  }
}
```

6. Configure MCP servers in `config/mcp.json`:
```json
{
  "mcpServers": {
    "your-server": {
      "command": "node",
      "args": ["path/to/server.js"]
    }
  }
}
```

## Database Setup

The application will automatically:
1. Create the `mcp_tools` database if it doesn't exist
2. Enable the pgvector extension
3. Create the necessary tables and indexes
4. Index MCP tools on startup

Manual setup (optional):
```sql
CREATE DATABASE mcp_tools;
\c mcp_tools
CREATE EXTENSION vector;
```

## Running the Application

Development mode:
```bash
npm run dev
```

Production build:
```bash
npm run build
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Configuration

### Database Configuration (`config/database.json`)

- **postgresql**: PostgreSQL connection settings
  - `host`: Database host
  - `port`: Database port (default: 5432)
  - `database`: Database name (default: mcp_tools)
  - `user`: Database user
  - `password`: Database password
  - `ssl`: Enable SSL connection
  - `pool`: Connection pool settings

- **pgvector**: Vector search settings
  - `enabled`: Enable/disable vector search
  - `similarityThreshold`: Minimum similarity score (0-1)
  - `maxResults`: Maximum search results

### LLM Configuration (`config/llm.json`)

Configure your LLM service settings:

- `url`: LLM API endpoint (OpenAI-compatible)
- `apiKey`: API authentication key
- `timeout`: Request timeout in milliseconds (default: 30000)
- `maxTokens`: Maximum tokens per response (default: 2000)
- `temperature`: Response randomness 0-1 (default: 0.7)
- `headers`: Additional HTTP headers (optional)

**Note**: Environment variables `LLM_URL` and `LLM_API_KEY` are still supported as fallbacks if the config file is not available.

### Embeddings Configuration (`config/embeddings.json`)

Configure the embeddings service for text similarity and tool routing:

```json
{
  "provider": "openai",
  "model": "text-embedding-ada-002",
  "dimensions": 1536,
  "endpoint": "/embeddings",
  "batchSize": 100,
  "fallback": {
    "enabled": true,
    "type": "mock"
  }
}
```

- `provider`: Embedding service provider (currently supports "openai")
- `model`: Embedding model to use
- `dimensions`: Vector dimensions for embeddings
- `endpoint`: API endpoint for embeddings
- `batchSize`: Maximum number of texts to process in one batch
- `fallback`: Fallback configuration when the embedding service is unavailable

### MCP Configuration (`config/mcp.json`)

Define MCP servers and their connection details. Supports both stdio and HTTP transports.

Example configuration:
```json
{
  "mcpServers": {
    "gurddy-stdio": {
      "name": "gurddy-stdio",
      "transport": "stdio",
      "command": "gurddy-mcp",
      "args": [],
      "env": {},
      "disabled": false,
      "autoApprove": ["solve_n_queens", "solve_sudoku"]
    },
    "example-http": {
      "name": "example-http",
      "transport": "http",
      "url": "http://localhost:3001",
      "timeout": 60000,
      "retryAttempts": 3,
      "retryDelay": 1000,
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

**Transport Types:**
- `stdio`: Process-based communication (default)
  - `command`: Executable command
  - `args`: Command arguments
  - `env`: Environment variables
- `http`: HTTP-based communication
  - `url`: MCP server URL
  - `timeout`: Request timeout in milliseconds
  - `retryAttempts`: Number of retry attempts
  - `retryDelay`: Delay between retries in milliseconds

See [MCP documentation](https://modelcontextprotocol.io) for details.

## How It Works

1. **Tool Discovery**: MCP tools are loaded from configured servers
2. **Embedding Generation**: Tool descriptions are converted to embeddings using the LLM API
3. **Vector Storage**: Embeddings are stored in PostgreSQL with pgvector
4. **Query Processing**: User queries are embedded and matched against tool embeddings
5. **Tool Selection**: Most relevant tools are selected based on semantic similarity
6. **Execution**: Selected tools are executed and results returned to the LLM
7. **Response Generation**: LLM generates a natural language response

## API Endpoints

- `POST /api/chat` - Send chat messages
- `GET /api/tools` - List available tools
- `POST /api/tools/search` - Search tools by query
- `POST /api/tools/index` - Trigger tool indexing
- `GET /api/config` - Get system configuration
- `POST /api/test-mcp` - Test MCP connections (stdio/http)

## Testing MCP Connections

Visit [http://localhost:3000/test-mcp](http://localhost:3000/test-mcp) to test MCP server connections.

The test page supports:
- **stdio transport**: Test process-based MCP servers
- **http transport**: Test HTTP-based MCP servers
- **Multiple methods**: initialize, tools/list, tools/call, ping
- **Custom parameters**: Configure command, args, env, URL, etc.

Example API usage:
```bash
# Test stdio MCP server
curl -X POST http://localhost:3000/api/test-mcp \
  -H "Content-Type: application/json" \
  -d '{
    "transport": "stdio",
    "command": "gurddy-mcp",
    "args": [],
    "env": {},
    "method": "initialize",
    "params": {}
  }'

# Test HTTP MCP server
curl -X POST http://localhost:3000/api/test-mcp \
  -H "Content-Type: application/json" \
  -d '{
    "transport": "http",
    "url": "http://localhost:3001",
    "method": "initialize",
    "params": {}
  }'
```

## Development

Run pgvector

docker-compose up -d 
```yaml
#docker-compose.yaml 
version: '3'
services:
  postgres:
    image: pgvector/pgvector:pg18
    container_name: postgres
    restart: always
    environment:
      TZ: Asia/Shanghai
      POSTGRES_USER: root
      POSTGRES_PASSWORD: 123456
      POSTGRES_DB: postgres
    ports:
      - "5432:5432"
    volumes:
      - /etc/localtime:/etc/localtime:ro
      - pgdata:/var/lib/postgresql/data:rw
volumes:
  pgdata:
    driver: local
```

Run tests:
```bash
npm test
```

Type checking:
```bash
npm run type-check
```

Linting:
```bash
npm run lint
```

## Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running
- Verify credentials in `config/database.json`
- Check if pgvector extension is installed

### Vector Search Not Working
- Verify `pgvector.enabled` is `true` in config
- Check if tools are indexed: `GET /api/tools/index`
- Ensure embedding service is initialized

### MCP Tools Not Loading
- Verify MCP server configuration in `config/mcp.json`
- Check MCP server logs
- Ensure server commands are executable

## License

MIT
