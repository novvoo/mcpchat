// LLM关键词生成服务
import fs from 'fs';
import path from 'path';

interface KeywordGenerationResult {
  keywords: string[];
  confidence: number;
  reasoning: string;
}

interface LLMKeywordGenerator {
  generateKeywords(toolName: string, description: string): Promise<string[]>;
}

export async function createLLMKeywordGenerator(): Promise<LLMKeywordGenerator | null> {
  try {
    // 动态导入LangChain模块
    const { ChatOpenAI } = await import('@langchain/openai');
    const { StructuredOutputParser } = await import('@langchain/core/output_parsers');
    const { PromptTemplate } = await import('@langchain/core/prompts');
    const { z } = await import('zod');

    // 加载LLM配置
    const llmConfigPath = path.join(process.cwd(), 'config', 'llm.json');
    if (!fs.existsSync(llmConfigPath)) {
      console.warn('LLM配置文件不存在:', llmConfigPath);
      return null;
    }

    const llmConfig = JSON.parse(fs.readFileSync(llmConfigPath, 'utf-8'));

    // 检查API key是否有效
    if (!llmConfig.apiKey || llmConfig.apiKey === 'your-actual-api-key-here') {
      console.warn('API key未配置，LLM关键词生成不可用');
      return null;
    }

    // 初始化LLM
    const llm = new ChatOpenAI({
      openAIApiKey: llmConfig.apiKey,
      configuration: {
        baseURL: llmConfig.url.replace('/chat/completions', ''),
      },
      temperature: llmConfig.temperature || 0.3,
      maxTokens: llmConfig.maxTokens || 1000,
    });

    // 定义输出结构
    const keywordSchema = z.object({
      keywords: z.array(z.string()).describe('生成的关键词列表'),
      confidence: z.number().min(0).max(1).describe('整体置信度'),
      reasoning: z.string().describe('生成关键词的推理过程')
    });

    // 创建结构化输出解析器
    const parser = StructuredOutputParser.fromZodSchema(keywordSchema);

    // 创建提示模板
    const promptTemplate = PromptTemplate.fromTemplate(`
你是一个专业的工具关键词生成专家。请为给定的工具生成相关的中文和英文关键词。

工具名称: {toolName}
工具描述: {description}

请生成10-15个高质量的关键词，包括：
1. 直接相关的功能词汇
2. 同义词和近义词
3. 应用场景词汇
4. 技术领域词汇
5. 中英文对照词汇

要求：
- 关键词应该准确反映工具的功能和用途
- 包含中文和英文关键词
- 避免过于通用的词汇
- 关键词长度在2-10个字符之间
- 优先考虑用户可能搜索的词汇

{format_instructions}
`);

    return {
      async generateKeywords(toolName: string, description: string): Promise<string[]> {
        try {
          const prompt = await promptTemplate.format({
            toolName,
            description: description || '无描述',
            format_instructions: parser.getFormatInstructions()
          });

          const response = await llm.invoke(prompt);
          const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
          const parsed = await parser.parse(content);

          // 过滤和清理关键词
          const cleanedKeywords = parsed.keywords
            .filter(keyword => keyword && keyword.length >= 2 && keyword.length <= 10)
            .filter(keyword => !['the', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'a', 'an'].includes(keyword.toLowerCase()))
            .map(keyword => keyword.trim().toLowerCase());

          return [...new Set(cleanedKeywords)]; // 去重
        } catch (error) {
          console.error(`LLM关键词生成失败 (${toolName}):`, error instanceof Error ? error.message : String(error));
          return [];
        }
      }
    };

  } catch (error) {
    console.error('创建LLM关键词生成器失败:', error instanceof Error ? error.message : String(error));
    return null;
  }
}

// 基于规则生成关键词
export function generateRuleBasedKeywords(toolName: string, description: string): string[] {
  const keywords = new Set<string>();

  // 添加工具名本身
  keywords.add(toolName);

  // 处理下划线分隔的工具名
  if (toolName.includes('_')) {
    const parts = toolName.split('_');
    parts.forEach(part => {
      if (part.length > 2) keywords.add(part);
    });
    keywords.add(parts.join(' '));
  }

  // 回显工具
  if (toolName.includes('echo')) {
    keywords.add('回显');
    keywords.add('输出');
    keywords.add('打印');
    keywords.add('echo');
    keywords.add('print');
    keywords.add('output');
    keywords.add('显示');
  }

  // 信息查询工具
  if (toolName.includes('info')) {
    keywords.add('信息');
    keywords.add('详情');
    keywords.add('查看');
    keywords.add('info');
    keywords.add('information');
    keywords.add('details');
    keywords.add('查询');
    keywords.add('query');
    keywords.add('获取信息');
    keywords.add('系统信息');
  }

  // 安装类工具
  if (toolName.includes('install')) {
    keywords.add('安装');
    keywords.add('部署');
    keywords.add('配置');
    keywords.add('install');
    keywords.add('setup');
    keywords.add('deploy');
    keywords.add('包管理');
    keywords.add('package manager');
    keywords.add('软件安装');
    keywords.add('环境配置');
  }

  // 运行类工具
  if (toolName.includes('run')) {
    keywords.add('运行');
    keywords.add('执行');
    keywords.add('启动');
    keywords.add('run');
    keywords.add('execute');
    keywords.add('start');

    if (toolName.includes('example')) {
      keywords.add('示例');
      keywords.add('例子');
      keywords.add('演示');
      keywords.add('example');
      keywords.add('demo');
      keywords.add('sample');
      keywords.add('测试运行');
      keywords.add('样例执行');
    }
  }

  // 求解类工具
  if (toolName.includes('solve')) {
    keywords.add('解决');
    keywords.add('求解');
    keywords.add('计算');
    keywords.add('solve');
    keywords.add('calculate');
    keywords.add('solution');
    keywords.add('问题求解');
    keywords.add('数学计算');
  }

  // 从描述中提取关键词
  if (description) {
    const descWords = description.toLowerCase().split(/\s+/);
    descWords.forEach(word => {
      if (word.length >= 3 && word.length <= 10) {
        keywords.add(word);
      }
    });
  }

  // 过滤无效关键词
  return Array.from(keywords).filter(keyword =>
    keyword &&
    keyword.length >= 2 &&
    !['the', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'a', 'an'].includes(keyword.toLowerCase())
  );
}