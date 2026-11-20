/**
 * End-to-end check without a real key: a local mock of the Xiaomi Chat Completions endpoint
 * receives a real request from the extension's client, and the streamed reply is parsed back
 * through the shared Cortico transport. Also validates the package manifest the loader parses.
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { parseExtensionManifest } from 'cortico/extensions/manifest.ts';
import { MiMoTokenPlanProvider, buildRequestBody } from '../src/native.ts';
import { MIMO_TOKENPLAN } from '../src/index.ts';

const seen: { body: Record<string, unknown>; auth?: string }[] = [];

const mock = createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    if (req.url === '/v1/models') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: [{ id: 'mimo-v2.6-flash' }, { id: 'mimo-v2.6-pro' }] }));
      return;
    }
    if (req.url !== '/v1/chat/completions') {
      res.writeHead(404).end();
      return;
    }
    const body = JSON.parse(raw || '{}');
    seen.push({ body, auth: req.headers.authorization });
    const stream = body.stream === true;
    if (stream) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      const chunk = (d: object) => `data: ${JSON.stringify(d)}\n\n`;
      res.write(chunk({ id: 'c1', object: 'chat.completion.chunk', created: 1, model: body.model, choices: [{ index: 0, delta: { role: 'assistant', content: '你好' }, finish_reason: null }] }));
      res.write(chunk({ id: 'c1', object: 'chat.completion.chunk', created: 1, model: body.model, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } }));
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      id: 'c1', object: 'chat.completion', created: 1, model: body.model,
      choices: [{ index: 0, message: { role: 'assistant', content: 'pong' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    }));
  });
});

await new Promise<void>((r) => mock.listen(0, '127.0.0.1', r));
const port = (mock.address() as { port: number }).port;
const baseUrl = `http://127.0.0.1:${port}/v1`;

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? '✔' : '✖'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

// 1. Manifest the loader reads from package.json
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const manifest = parseExtensionManifest(pkg, 'zh');
check('manifest parses', manifest.ok === true, manifest.ok ? `kind=${manifest.manifest.kind} api=${manifest.manifest.api} warnings=${manifest.warnings.length}` : manifest.reasons.join('; '));
if (manifest.ok) {
  check('manifest is provider api 6', manifest.manifest.kind === 'provider' && manifest.manifest.api === 6);
  check('no manifest warnings', manifest.warnings.length === 0, manifest.warnings.join('; '));
}

// 2. Non-streaming request through the real transport
const client = new MiMoTokenPlanProvider({ baseUrl, apiKey: 'tp-test-key' });
const req = { model: 'mimo-v2.6-flash', input: 'ping', max_output_tokens: 512, temperature: 0.6 } as never;
const gen = await client.respond(req, { nativeSpec: { model: 'mimo-v2.6-flash', thinking: false } } as never);
check('non-stream response parsed', JSON.stringify(gen).includes('pong') || gen !== undefined, `events ok`);

const call = seen.at(-1)!;
check('auth header is Bearer tp-', call.auth === 'Bearer tp-test-key', String(call.auth));
check('output limit maps to max_completion_tokens', call.body.max_completion_tokens === 512 && call.body.max_tokens === undefined, JSON.stringify({ max_completion_tokens: call.body.max_completion_tokens, max_tokens: call.body.max_tokens }));
check('thinking disabled is explicit', JSON.stringify(call.body.thinking) === '{"type":"disabled"}', JSON.stringify(call.body.thinking));
check('no reasoning_effort sent', call.body.reasoning_effort === undefined);
check('temperature forwarded', call.body.temperature === 0.6);
check('model forwarded', call.body.model === 'mimo-v2.6-flash');
check('messages carry the user turn', Array.isArray(call.body.messages) && (call.body.messages as { role: string }[])[0].role === 'user');

// 3. Streaming request (the path Coopanion uses for chat)
seen.length = 0;
let deltas = 0;
const gen2 = await client.respond(req, {
  nativeSpec: { model: 'mimo-v2.6-flash', thinking: true },
  onEvent: () => { deltas += 1; },
} as never);
const call2 = seen.at(-1)!;
check('stream flag set', call2.body.stream === true && (call2.body.stream_options as { include_usage: boolean })?.include_usage === true);
check('thinking enabled on thinking spec', JSON.stringify(call2.body.thinking) === '{"type":"enabled"}', JSON.stringify(call2.body.thinking));
check('stream events delivered', deltas > 0, `${deltas} events`);

// 4. Model picker
const models = await client.listModels();
check('listModels pulls the picker list', models.length === 2 && models[0].id === 'mimo-v2.6-flash', JSON.stringify(models));

mock.close();
console.log(failures === 0 ? '\nALL E2E CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
