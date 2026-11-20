import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRequestBody } from '../src/native.ts';
import { MIMO_TOKENPLAN } from '../src/index.ts';

const messages = [
  { role: 'user', content: '你好' },
] as never[];

test('thinking on sends enabled and keeps the official output-limit field', () => {
  const body = buildRequestBody({ model: 'mimo-v2.6-flash', thinking: true, maxTokens: 1024, temperature: 0.7 }, messages);
  assert.equal(body.model, 'mimo-v2.6-flash');
  assert.deepEqual(body.thinking, { type: 'enabled' });
  assert.equal(body.max_completion_tokens, 1024);
  assert.equal(body.max_tokens, undefined, 'must not send the legacy max_tokens field');
  assert.equal(body.temperature, 0.7);
  assert.equal(body.reasoning_effort, undefined, 'MiMo has no reasoning_effort parameter');
  assert.equal(body.stream, undefined, 'stream flags are added by the transport');
});

test('thinking off is stated explicitly so hybrid models stay cheap', () => {
  const body = buildRequestBody({ model: 'mimo-v2.6-pro', thinking: false }, messages);
  assert.deepEqual(body.thinking, { type: 'disabled' });
  assert.equal(body.temperature, undefined, 'omitted temperature keeps the endpoint default');
});

test('tools are mapped through the shared chat transport', () => {
  const tools = [
    { name: 'get_weather', description: 'get weather', parameters: { type: 'object', properties: {} } },
  ] as never[];
  const body = buildRequestBody({ model: 'mimo-v2.6-flash', thinking: false }, messages, tools);
  assert.ok(Array.isArray(body.tools));
  assert.equal((body.tools as { function: { name: string } }[])[0].function.name, 'get_weather');
});

test('thinking mode replays prior reasoning_content, thinking-off drops it', () => {
  const withReasoning = [
    { role: 'assistant', content: 'answer', reasoning_content: 'because' },
    { role: 'user', content: 'next' },
  ] as never[];
  const on = buildRequestBody({ model: 'mimo-v2.6-pro', thinking: true }, withReasoning);
  assert.equal((on.messages as { reasoning_content?: string }[])[0].reasoning_content, 'because');
  const off = buildRequestBody({ model: 'mimo-v2.6-pro', thinking: false }, withReasoning);
  assert.equal((off.messages as { reasoning_content?: string }[])[0].reasoning_content, undefined);
});

test('module declares the Token Plan contract', () => {
  assert.equal(MIMO_TOKENPLAN.id, 'mimo-tokenplan');
  assert.equal(MIMO_TOKENPLAN.defaultBaseUrl, 'https://token-plan-cn.xiaomimimo.com/v1');
  assert.equal(MIMO_TOKENPLAN.baseUrlSuggestions?.length, 3);
  assert.deepEqual(MIMO_TOKENPLAN.describe?.protocols, ['openai-chat']);
  assert.deepEqual(MIMO_TOKENPLAN.describe?.auth, ['api-key']);
  assert.equal(MIMO_TOKENPLAN.reasoningTiers.length, 2);
  assert.equal(MIMO_TOKENPLAN.serviceTiers.length, 0);
});
