# cortico-provider-mimo-tokenplan

Cortico / Coopanion provider for the **Xiaomi MiMo Token Plan** subscription endpoint
(OpenAI Chat Completions compatible).

Get a Token Plan subscription and the exclusive `tp-` API key at the
[Token Plan console](https://platform.xiaomimimo.com/#/console/plan-manage), then add a new
endpoint in Coopanion → Advanced mode → Model connections.

## Base URL (pick by region)

| Region | Base URL |
|---|---|
| China (default) | `https://token-plan-cn.xiaomimimo.com/v1` |
| Singapore | `https://token-plan-sgp.xiaomimimo.com/v1` |
| Amsterdam | `https://token-plan-ams.xiaomimimo.com/v1` |

All three are offered as URL suggestions when you create the endpoint. Do **not** use the
pay-as-you-go base (`https://api.xiaomimimo.com/v1`): Token Plan keys (`tp-` / `ttp-`) and
pay-as-you-go keys (`sk-`) are independent and cannot be mixed.

## Supported models

| Model | Context / max output | Notes |
|---|---|---|
| `mimo-v2.6-flash` | 1M / 128K | cheapest per token — recommended for daily chat |
| `mimo-v2.6-pro` | 1M / 128K | strongest |
| `mimo-v2.6-pro-ultraspeed` | 1M / 128K | Pro/Max plans, time-limited |

The model name is typed into the endpoint's model field; `GET {base}/models` fills the picker
when the endpoint exposes it.

## What this provider maps

- **Auth**: `Authorization: Bearer tp-…` (the platform also accepts an `api-key` header).
- **Output limit**: `spec.maxTokens` → `max_completion_tokens` (the field the official curl
  template uses).
- **Thinking**: the tier selector in Coopanion (思考 on/off) → top-level
  `thinking: { type: "enabled" | "disabled" }`. MiMo v2.6 models are hybrid-reasoning and lean
  toward thinking on, so the mode is always stated explicitly; non-thinking runs stay cheap.
- **Not sent**: `reasoning_effort` (not a documented MiMo parameter), prices (MiMo bills in
  Credits, not per-million-token USD — fill prices by hand on the endpoint page if you want
  cost estimates).
- Tools, streaming (`stream` + `stream_options.include_usage`) and history `reasoning_content`
  flow through the shared Cortico chat transport.

## Installation

1. In Coopanion open **高级模式 → 模型供应商 → 扩展市场 → 手动安装**.
2. Install from this directory (「从本机目录安装」) or, once published, by package name
   `cortico-provider-mimo-tokenplan`.
3. Restart the core when prompted, then add a new endpoint and pick **小米 MiMo Token Plan**
   as the service.

## Compliance note

Xiaomi's Token Plan terms state the subscription quota is meant for coding tools; using the
key in other applications may be treated as abuse and the key suspended. If you would rather
avoid that risk, point this same provider at the pay-as-you-go base
`https://api.xiaomimimo.com/v1` with an `sk-` key — the request format is identical.

## License

MIT
