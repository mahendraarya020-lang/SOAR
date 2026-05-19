import dotenv from 'dotenv';

dotenv.config();

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const DEFAULT_MODEL = 'gemma:latest';

const sampleSecurityLog = `
[WARNING] Unauthorized login attempt detected.
IP Address: 192.168.1.105
Timestamp: 2026-05-19T10:00:00Z
User: admin
Action: Failed Password
`;

const prompt = `Analyze this security log and tell me if it is suspicious, and what actions to take:\n${sampleSecurityLog}`;

interface ModelTag {
  name: string;
}

async function getAvailableModels(): Promise<string[]> {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    if (!res.ok) return [];
    const data = await res.json() as { models?: ModelTag[] };
    return (data.models || []).map((m) => m.name);
  } catch {
    return [];
  }
}

async function tryGenerate(model: string, endpoint: '/api/generate' | '/api/chat'): Promise<boolean> {
  console.log(`\n🤖 Sending request to "${model}" via "${endpoint}"...`);
  
  const isChat = endpoint === '/api/chat';
  const body = isChat 
    ? {
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      }
    : {
        model,
        prompt,
        stream: true,
      };

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`⚠️  Endpoint ${endpoint} failed for "${model}": ${response.status} - ${errText.trim()}`);
      return false;
    }

    if (!response.body) {
      throw new Error('Response body is empty');
    }

    console.log(`\n--- [STREAMING RESPONSE FROM ${model.toUpperCase()}] ---`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter((line) => line.trim() !== '');

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          const text = isChat ? parsed.message?.content : parsed.response;
          if (text) {
            process.stdout.write(text);
          }
        } catch {
          // Ignore json parsing errors from split chunks
        }
      }
    }
    console.log('\n--- [STREAM COMPLETED] ---\n');
    return true;
  } catch (err) {
    console.error(`❌ Connection error using ${model} via ${endpoint}:`, (err as Error).message);
    return false;
  }
}

async function main() {
  console.log('==================================================');
  console.log('🛡️  AI SOAR Dashboard - Ollama Connection Test 🛡️');
  console.log('==================================================');
  console.log(`Connecting to local Ollama instance at: ${OLLAMA_BASE_URL}\n`);

  const models = await getAvailableModels();
  if (models.length === 0) {
    console.error('❌ No active Ollama models detected. Please verify Ollama is running.');
    console.error('Command to start/run: "ollama run gemma" or "ollama run llama3.2"\n');
    return;
  }

  console.log(`Available local models detected: ${models.join(', ')}`);

  // We want to prioritize 'gemma' as requested, but fall back gracefully to others if gemma fails or is not found.
  const preferredModels = ['gemma:latest', 'gemma', 'llama3.2:latest', 'llama3.2', ...models];
  const uniqueModelsToTry = Array.from(new Set(preferredModels.filter(m => models.includes(m))));

  if (uniqueModelsToTry.length === 0) {
    console.error('❌ None of the detected models are in our compatibility list.');
    return;
  }

  for (const model of uniqueModelsToTry) {
    console.log(`\n👉 Trying model: ${model}`);
    
    // 1. Try /api/generate
    let success = await tryGenerate(model, '/api/generate');
    if (success) return;

    // 2. Try /api/chat
    success = await tryGenerate(model, '/api/chat');
    if (success) return;
  }

  console.error('\n❌ All attempted models and endpoints failed. Please check Ollama logs.');
}

main();
