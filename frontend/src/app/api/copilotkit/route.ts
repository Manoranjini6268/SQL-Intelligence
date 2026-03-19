import { CopilotRuntime, OpenAIAdapter, copilotRuntimeNextJSAppRouterEndpoint } from '@copilotkit/runtime';
import OpenAI from 'openai';

// Create an OpenAI-compatible client pointing at Cerebras
const cerebras = new OpenAI({
  apiKey: process.env.CEREBRAS_API_KEY || '',
  baseURL: process.env.CEREBRAS_API_URL || 'https://api.cerebras.ai',
});

const serviceAdapter = new OpenAIAdapter({
  openai: cerebras as any,
  model: process.env.CEREBRAS_MODEL || 'gpt-oss-120b',
});

const runtime = new CopilotRuntime({
  actions: [],
});

const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
  runtime,
  serviceAdapter,
  endpoint: '/api/copilotkit',
});

export const POST = handleRequest;
