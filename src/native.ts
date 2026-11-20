/**
 * Xiaomi MiMo Token Plan Chat Completions client. The endpoint is an OpenAI Chat Completions
 * dialect (official docs: `POST {base}/chat/completions`); `OpenAIHttpClient` handles HTTP/SSE,
 * retries, metering and stream assembly.
 *
 * Xiaomi-specific request fields:
 * - output limit is `max_completion_tokens` (the official curl template uses it);
 * - the thinking switch is the top-level object `thinking: { type: 'enabled' | 'disabled' }`
 *   (MiMo v2.6 models are hybrid-reasoning; pass it explicitly so non-thinking runs stay cheap);
 * - `reasoning_effort` is not a documented MiMo parameter and is never sent.
 */
import type { Logger, ModelSpec, ToolSchema } from 'cortico/core/types.ts';
import { nullLogger } from 'cortico/core/util.ts';
import { OpenAIHttpClient } from 'cortico/providers/transport/chat.ts';
import { mapTools, renderMessagesWithMedia, type CompatMediaOptions } from 'cortico/providers/transport/history.ts';
import type { NativeChatMessage } from 'cortico/providers/transport/native-types.ts';

/** Build the chat.completions body for one MiMo request. Exported for tests. */
export function buildRequestBody(
  spec: ModelSpec,
  messages: NativeChatMessage[],
  tools?: ToolSchema[],
  media?: CompatMediaOptions,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: spec.model,
    // In thinking mode MiMo recommends replaying prior reasoning_content for best multi-turn
    // quality; outside thinking mode the field is dropped.
    messages: renderMessagesWithMedia(messages, media, spec.thinking ? { keepReasoning: true } : undefined),
    // MiMo models default to thinking on; always state the mode explicitly.
    thinking: { type: spec.thinking ? 'enabled' : 'disabled' },
  };
  if (spec.temperature !== undefined) body.temperature = spec.temperature;
  if (spec.maxTokens !== undefined) body.max_completion_tokens = spec.maxTokens;
  const mapped = mapTools(tools);
  if (mapped) body.tools = mapped;
  return body;
}

export class MiMoTokenPlanProvider extends OpenAIHttpClient {
  private readonly apiKey?: string;
  private readonly media?: CompatMediaOptions;

  constructor(opts: { baseUrl: string; apiKey?: string; log?: Logger; media?: CompatMediaOptions }) {
    super(opts.baseUrl, opts.log ?? nullLogger());
    this.apiKey = opts.apiKey;
    this.media = opts.media;
  }

  protected buildBody(spec: ModelSpec, messages: NativeChatMessage[], tools?: ToolSchema[]): Record<string, unknown> {
    return buildRequestBody(spec, messages, tools, this.media);
  }

  protected headers(): Record<string, string> {
    // Both `Authorization: Bearer` and `api-key` are accepted by the platform; Bearer is the
    // OpenAI SDK default and is what the official balance endpoint documents.
    return {
      'Content-Type': 'application/json',
      ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
    };
  }

  /** `GET {base}/models` when the endpoint exposes it; used by the model picker. */
  async listModels(): Promise<{ id: string; displayName?: string }[]> {
    const url = `${this.baseUrl.replace(/\/+$/, '')}/models`;
    try {
      const res = await fetch(url, { headers: this.headers() });
      if (!res.ok) return [];
      const raw = (await res.json()) as { data?: { id?: string }[] };
      return (raw.data ?? [])
        .filter((m): m is { id: string } => typeof m?.id === 'string' && m.id.length > 0)
        .map((m) => ({ id: m.id }));
    } catch {
      return [];
    }
  }
}
