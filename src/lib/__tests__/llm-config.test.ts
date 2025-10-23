import { getLLMConfig, clearLLMConfigCache } from '../llm-config'
import { promises as fs } from 'fs'
import path from 'path'

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn()
  }
}))

const mockReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>

describe('LLM Config Loader', () => {
  beforeEach(() => {
    clearLLMConfigCache()
    jest.clearAllMocks()
  })

  it('loads LLM config from file successfully', async () => {
    const mockConfig = {
      url: 'https://api.openai.com/v1/chat/completions',
      apiKey: 'sk-test-key',
      timeout: 60000,
      maxTokens: 4000,
      temperature: 0.8,
      headers: {
        'User-Agent': 'MyApp/1.0'
      }
    }

    mockReadFile.mockResolvedValue(JSON.stringify(mockConfig))

    const config = await getLLMConfig()

    expect(config).toEqual({
      url: 'https://api.openai.com/v1/chat/completions',
      apiKey: 'sk-test-key',
      timeout: 60000,
      maxTokens: 4000,
      temperature: 0.8,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'MyApp/1.0',
        'Authorization': 'Bearer sk-test-key'
      }
    })

    expect(mockReadFile).toHaveBeenCalledWith(
      path.resolve(process.cwd(), 'config/llm.json'),
      'utf-8'
    )
  })

  it('uses default config when file read fails', async () => {
    mockReadFile.mockRejectedValue(new Error('File not found'))

    const config = await getLLMConfig()

    expect(config).toEqual({
      url: 'https://ch.at/v1/chat/completions',
      apiKey: '',
      timeout: 30000,
      maxTokens: 2000,
      temperature: 0.7,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  })

  it('handles partial config with defaults', async () => {
    const partialConfig = {
      url: 'https://custom-api.com/v1/chat/completions',
      apiKey: 'custom-key'
    }

    mockReadFile.mockResolvedValue(JSON.stringify(partialConfig))

    const config = await getLLMConfig()

    expect(config).toEqual({
      url: 'https://custom-api.com/v1/chat/completions',
      apiKey: 'custom-key',
      timeout: 30000,
      maxTokens: 2000,
      temperature: 0.7,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer custom-key'
      }
    })
  })

  it('caches config after first load', async () => {
    const mockConfig = {
      url: 'https://api.test.com/v1/chat/completions',
      apiKey: 'test-key'
    }

    mockReadFile.mockResolvedValue(JSON.stringify(mockConfig))

    // First call
    await getLLMConfig()
    // Second call
    await getLLMConfig()

    // Should only read file once due to caching
    expect(mockReadFile).toHaveBeenCalledTimes(1)
  })

  it('handles invalid JSON gracefully', async () => {
    mockReadFile.mockResolvedValue('invalid json')

    const config = await getLLMConfig()

    expect(config).toEqual({
      url: 'https://ch.at/v1/chat/completions',
      apiKey: '',
      timeout: 30000,
      maxTokens: 2000,
      temperature: 0.7,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  })
})