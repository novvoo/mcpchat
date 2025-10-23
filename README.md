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
- **Embedding Service**: Generates embeddings via LLM API (text-embedding-3-small)
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

4. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env`:
```env
LLM_URL=https://your-llm-api.com/v1
LLM_API_KEY=your-api-key
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

6. Configure MCP servers in `mcp.json`:
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

### LLM Configuration (Environment Variables)

- `LLM_URL`: LLM API endpoint (OpenAI-compatible)
- `LLM_API_KEY`: API authentication key

### MCP Configuration (`mcp.json`)

Define MCP servers and their connection details. See [MCP documentation](https://modelcontextprotocol.io) for details.

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
- Verify MCP server configuration in `mcp.json`
- Check MCP server logs
- Ensure server commands are executable

## License

MIT
