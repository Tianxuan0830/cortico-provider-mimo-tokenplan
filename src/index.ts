/**
 * Cortico provider for the Xiaomi MiMo Token Plan subscription endpoint
 * (`https://token-plan-cn.xiaomimimo.com/v1`, also sgp / ams clusters). The endpoint speaks
 * OpenAI Chat Completions with a `tp-` API key taken from the Token Plan console; no
 * reasoning-effort parameter is documented, so only the thinking switch is mapped.
 */
import type { ProviderModule } from 'cortico/providers/base.ts';
import { isContextOverflow } from 'cortico/providers/transport/errors.ts';
import { MiMoTokenPlanProvider } from './native.ts';

const BASE_URLS = [
  'https://token-plan-cn.xiaomimimo.com/v1',
  'https://token-plan-sgp.xiaomimimo.com/v1',
  'https://token-plan-ams.xiaomimimo.com/v1',
] as const;

export const MIMO_TOKENPLAN = {
  id: 'mimo-tokenplan',
  title: '小米 MiMo Token Plan',
  description:
    '小米 MiMo Token Plan 订阅端点（OpenAI Chat Completions 兼容）。在 Token Plan 控制台获取 tp- 开头的专属 API Key，按区域选择 Base URL。可用模型：mimo-v2.6-pro、mimo-v2.6-flash。',
  describe: { protocols: ['openai-chat'], auth: ['api-key'], local: false, input: ['text'] as const },
  defaultBaseUrl: BASE_URLS[0],
  baseUrlSuggestions: BASE_URLS,
  // Thinking on/off only; MiMo documents no reasoning-effort parameter, and the tier value is
  // never sent as reasoning_effort.
  reasoningTiers: [
    { id: 'off', label: '关闭思考', thinking: false },
    { id: 'on', label: '开启思考', thinking: true },
  ],
  serviceTiers: [],
  contextOverflow: isContextOverflow,
  localize(language) {
    if (language === 'zh' || language === 'zh-Hant') return {};
    return {
      title: 'Xiaomi MiMo Token Plan',
      description:
        'Xiaomi MiMo Token Plan subscription endpoint (OpenAI Chat Completions compatible). Get the tp- API key from the Token Plan console and pick a regional Base URL. Models: mimo-v2.6-pro, mimo-v2.6-flash.',
      reasoningTiers: [
        { id: 'off', label: 'Thinking off', thinking: false },
        { id: 'on', label: 'Thinking on', thinking: true },
      ],
    };
  },
  create(name, entry, host) {
    const apiKey = entry.secret ? host.secret(entry.secret) : undefined;
    const client = new MiMoTokenPlanProvider({
      baseUrl: entry.baseUrl,
      apiKey,
      log: host.log,
      media: { enabled: () => entry.multimodal === true, read: host.readBlob },
    });
    return {
      compatibilityKey: () => [name],
      client,
      listModels: () => client.listModels(),
    };
  },
} satisfies ProviderModule;

export default MIMO_TOKENPLAN;
