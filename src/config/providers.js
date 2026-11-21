// ───────────────────────────────────────────────────────────────
// REGISTRY PROVIDER & MODEL — single source of truth.
// Dipakai oleh serverless function (api/*.js, Node) DAN frontend (Vite),
// jadi file ini harus murni ESM tanpa dependensi DOM/Node.
//
// Aturan keamanan: API key SELALU diambil dari process.env di server.
// Jangan pernah kirim key ke client.
//
// provider.api:
//   'openai'   → POST {baseUrl}/chat/completions (OpenAI-compatible, bisa SSE)
//   'nekolabs' → GET  {baseUrl}{model.endpoint}?… dengan header X-API-Key (tanpa SSE)
// ───────────────────────────────────────────────────────────────

export const PROVIDERS = {
  nl: {
    id: 'nl',
    label: 'NL',
    baseUrl: 'https://nekolabs.my.id/v1',
    envKey: 'NEKOLABS_API_KEY',
    api: 'nekolabs',
    supportsStream: false,
  },
  or: {
    id: 'or',
    label: 'OR',
    baseUrl: 'https://openrouter.ai/api/v1',
    envKey: 'OPENROUTER_API_KEY',
    api: 'openai',
    supportsStream: true,
  },
  cpllm: {
    id: 'cpllm',
    label: 'CpLLM',
    baseUrl: 'https://cheapllm.shop/v1',
    envKey: 'CHEAPLLM_API_KEY',
    api: 'openai',
    contextWindow: 131072,
    supportsStream: true,
  },
  k: {
    id: 'k',
    label: 'K',
    baseUrl: 'https://kenari.id/v1',
    envKey: 'KENARI_API_KEY',
    api: 'openai',
    supportsStream: true,
  },
};

// Model: { id, provider, label, supportsVision, contextWindow? }
// Khusus Nekolabs:
//   endpoint       path setelah baseUrl
//   queryParam     nama parameter teks (default 'content')
//   supportsSearch ikut mengirim conversationId/deviceId/needSearch (toggle "Cari di web")
//   imageInput     'url' → hanya menerima URL gambar https (bukan unggahan/data URL)
export const MODELS = [
  // Nekolabs
  { id: 'claude', provider: 'nl', label: 'Claude', supportsVision: false, endpoint: '/ai/claude', supportsSearch: true },
  { id: 'beam', provider: 'nl', label: 'Beam', supportsVision: false, endpoint: '/ai/beam' },
  { id: 'gemma', provider: 'nl', label: 'Gemma', supportsVision: false, endpoint: '/ai/gemma' },
  {
    id: 'vision',
    provider: 'nl',
    label: 'Neko Vision (URL gambar)',
    supportsVision: true,
    endpoint: '/image/vision',
    imageInput: 'url',
  },
  // OpenRouter
  {
    id: 'nvidia/nemotron-3-ultra-550b-a55b:free',
    provider: 'or',
    label: 'Nemotron 3 Ultra',
    supportsVision: false,
  },
  // CheapLLM
  {
    id: 'deepseek-v4.1-flash-1017',
    provider: 'cpllm',
    label: 'DeepSeek V4.1 Flash',
    supportsVision: false,
    contextWindow: 131072,
  },
  // Kenari
  { id: 'beam-1-0:free', provider: 'k', label: 'Beam 1.0', supportsVision: false },
  { id: 'dots-3-note-preview:free', provider: 'k', label: 'Dots 3 Note Preview', supportsVision: false },
  { id: 'ernie-5-5-flash-preview:free', provider: 'k', label: 'Ernie 5.5 Flash Preview', supportsVision: false },
  { id: 'flint-v1-0:free', provider: 'k', label: 'Flint v1.0', supportsVision: false },
  { id: 'glm-4-6v-flash:free', provider: 'k', label: 'GLM 4 6V Flash (vision)', supportsVision: true },
  { id: 'glm-4-7-flash:free', provider: 'k', label: 'GLM 4.7 Flash', supportsVision: false },
  { id: 'hy4-flash:free', provider: 'k', label: 'HY4 Flash', supportsVision: false },
  { id: 'laguna-xs-2-1:free', provider: 'k', label: 'Laguna XS 2.1', supportsVision: false },
  { id: 'lfm-3-1-7b:free', provider: 'k', label: 'LFM 3.1', supportsVision: false },
  { id: 'llama-3-3-70b-instruct:free', provider: 'k', label: 'Llama 3.3 Instruct', supportsVision: false },
  { id: 'longcat-2-5:free', provider: 'k', label: 'LongCat 2.5', supportsVision: false },
  { id: 'muse-glimmer-30b:free', provider: 'k', label: 'Muse Glimmer', supportsVision: false },
  { id: 'nemotron-3-5-lightning:free', provider: 'k', label: 'Nemotron 3.5 Lightning', supportsVision: false },
  { id: 'nemotron-3-5-super-vl:free', provider: 'k', label: 'Nemotron 3.5 Super VL', supportsVision: true },
  {
    id: 'nemotron-3-nano-omni-30b-a3b-reasoning:free',
    provider: 'k',
    label: 'Nemotron 3 Nano Omni',
    supportsVision: true,
  },
  { id: 'nemotron-3-ultra-550b-a55b:free', provider: 'k', label: 'Nemotron 3 Ultra', supportsVision: false },
  { id: 'north-mini-code:free', provider: 'k', label: 'North Mini Code', supportsVision: false },
  { id: 'particle-1:free', provider: 'k', label: 'Particle 1', supportsVision: false },
  { id: 'qwen3-5-397b-a17b:free', provider: 'k', label: 'Qwen3 5', supportsVision: false },
  { id: 'qwen3-6-27b:free', provider: 'k', label: 'Qwen3 6', supportsVision: false },
  { id: 'qwen3-8-27b:free', provider: 'k', label: 'Qwen3 8', supportsVision: false },
  { id: 'qwen3-8-omni-flash:free', provider: 'k', label: 'Qwen3 8 Omni Flash', supportsVision: true },
  { id: 'qwen4-max:free', provider: 'k', label: 'Qwen4 Max', supportsVision: false },
  { id: 'solar-mini4:free', provider: 'k', label: 'Solar Mini4', supportsVision: false },
];

// Alat gambar Nekolabs (GET {baseUrl}{endpoint}?url=…). Dipakai /api/image dan halaman Vision.
// options: parameter tambahan yang boleh dikirim.
export const IMAGE_TOOLS = [
  { id: 'restore', provider: 'nekolabs', endpoint: '/image/restore', options: ['upscale'] },
  { id: 'enhance', provider: 'nekolabs', endpoint: '/image/enhance', options: ['upscale', 'background'] },
  { id: 'rembg', provider: 'nekolabs', endpoint: '/image/rembg', options: [] },
];
export const UPSCALE_VALUES = [2, 4];

// Default seperti sebelum migrasi: Chat lewat Nekolabs, Coder lewat OpenRouter.
export const DEFAULT_CHAT_MODEL = 'nekolabs:claude';
export const DEFAULT_CODER_MODEL = 'openrouter:nvidia/nemotron-3-ultra-550b-a55b:free';
export const DEFAULT_VISION_MODEL = 'kenari:glm-4-6v-flash:free';

export const VISION_MODELS = MODELS.filter((m) => m.supportsVision);
export const TEXT_MODELS = MODELS.filter((m) => !m.supportsVision);

// Terima "provider:model-id" (id model boleh mengandung ':' dan '/')
export function resolveModel(modelKey) {
  if (!modelKey || typeof modelKey !== 'string') return null;
  const sep = modelKey.indexOf(':');
  if (sep === -1) return null;
  const provider = modelKey.slice(0, sep);
  const id = modelKey.slice(sep + 1);
  const model = MODELS.find((m) => m.provider === provider && m.id === id);
  if (!model) return null;
  return { ...model, providerConfig: PROVIDERS[provider] || null };
}

export function modelLabel(modelKey) {
  const m = resolveModel(modelKey);
  if (!m) return modelKey;
  const p = PROVIDERS[m.provider];
  return `${m.label} · ${p ? p.label : m.provider}`;
}
