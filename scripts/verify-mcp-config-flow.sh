#!/bin/bash

echo "🔍 验证 MCP 配置流程"
echo "===================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. 检查数据库连接
echo "1️⃣ 检查数据库连接..."
if npm run db:check > /dev/null 2>&1; then
    echo -e "${GREEN}✓ 数据库连接正常${NC}"
else
    echo -e "${RED}✗ 数据库连接失败${NC}"
    exit 1
fi
echo ""

# 2. 检查 mcp.json 文件
echo "2️⃣ 检查 config/mcp.json..."
if [ -f "config/mcp.json" ]; then
    echo -e "${GREEN}✓ 配置文件存在${NC}"
    echo "   服务器数量: $(cat config/mcp.json | jq '.mcpServers | length')"
else
    echo -e "${RED}✗ 配置文件不存在${NC}"
    exit 1
fi
echo ""

# 3. 初始化 MCP 配置表
echo "3️⃣ 初始化 MCP 配置表..."
if npm run db:init:mcp > /dev/null 2>&1; then
    echo -e "${GREEN}✓ 配置表初始化成功${NC}"
else
    echo -e "${RED}✗ 配置表初始化失败${NC}"
    exit 1
fi
echo ""

# 4. 测试 API 逻辑
echo "4️⃣ 测试 API 逻辑..."
if npm run test:mcp:config > /dev/null 2>&1; then
    echo -e "${GREEN}✓ API 逻辑测试通过${NC}"
else
    echo -e "${RED}✗ API 逻辑测试失败${NC}"
    exit 1
fi
echo ""

# 5. 检查应用是否运行
echo "5️⃣ 检查应用状态..."
if curl -s http://localhost:3000/api/mcp-config > /dev/null 2>&1; then
    echo -e "${GREEN}✓ 应用正在运行${NC}"
    
    # 6. 测试 API 端点
    echo ""
    echo "6️⃣ 测试 API 端点..."
    RESPONSE=$(curl -s http://localhost:3000/api/mcp-config)
    
    if echo "$RESPONSE" | jq -e '.mcpServers' > /dev/null 2>&1; then
        echo -e "${GREEN}✓ API 返回正确格式${NC}"
        SERVER_COUNT=$(echo "$RESPONSE" | jq '.mcpServers | length')
        echo "   服务器数量: $SERVER_COUNT"
        
        if [ "$SERVER_COUNT" -gt 0 ]; then
            echo ""
            echo "   服务器列表:"
            echo "$RESPONSE" | jq -r '.mcpServers | keys[]' | while read server; do
                echo "   - $server"
            done
        fi
    else
        echo -e "${RED}✗ API 返回格式错误${NC}"
        echo "   响应: $RESPONSE"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠ 应用未运行${NC}"
    echo "   请运行: npm run dev"
    echo ""
    echo "   然后访问: http://localhost:3000/admin/test-mcp-connection"
fi

echo ""
echo "===================="
echo -e "${GREEN}✅ 验证完成！${NC}"
echo ""
echo "📝 下一步:"
echo "   1. 如果应用未运行，执行: npm run dev"
echo "   2. 访问测试页面: http://localhost:3000/admin/test-mcp-connection"
echo "   3. 选择服务器并测试连接"
