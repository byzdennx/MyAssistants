// Vercel Serverless Function — proxy chat & vision ke semua provider di registry.
// API key SELALU dari process.env (NEKOLABS_API_KEY / OPENROUTER_API_KEY /
// CHEAPLLM_API_KEY / KENARI_API_KEY). Browser tidak pernah melihat key.
//
// Body: { provider, model, messages, stream?, vision?, needSearch?, deviceId?, max_tokens?, temperature? }
//   provider.api === 'openai'   → POST {baseUrl}/chat/completions (SSE diteruskan apa adanya)
//   provider.api === 'nekolabs' → GET  {baseUrl}{endpoint}?… (X-API-Key); jawaban dibungkus
//                                 ke bentuk OpenAI supaya client cukup satu parser.
// vision=true → model wajib supportsVision (divalidasi dari registry).
// Header X-Request-Id selalu dikembalikan bila provider mengirimnya.

import { resolveModel } from '../src/config/providers.js';

export const config = {
  api: { responseLimit: false },
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Nekolabs menerima teks lewat query GET, jadi panjangnya dibatasi.
const MAX_QUERY_CHARS = 12000;

const queryLength = (s) => new URLSearchParams({ c: s }).toString().length - 2;

// content OpenAI (string | [{type:'text'}, {type:'image_url'}]) → { text, images }
export function partsOf(content) {
  if (typeof content === 'string') return { text: content, images: [] };
  if (!Array.isArray(content)) return { text: '', images: [] };
  const text = content
    .filter((p) => p?.type === 'text' && typeof p.text === 'string')
    .map((p) => p.text)
    .join('\n');
  const images = content
    .filter((p) => p?.type === 'image_url')
    .map((p) => p.image_url?.url)
    .filter((u) => typeof u === 'string');
  return { text, images };
}

// messages[] → satu string untuk API yang hanya menerima satu teks.
// Mengembalikan null kalau pesan terbaru saja sudah melebihi batas.
export function flattenMessages(messages, budget = MAX_QUERY_CHARS) {
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => partsOf(m.content).text)
    .join('\n')
    .trim();
  const turns = messages.filter((m) => m.role === 'user' || m.role === 'assistant');
  const latest = turns.length ? partsOf(turns[turns.length - 1].content).text : '';
  const history = turns.slice(0, -1);

  const head = system ? `[SYSTEM PROMPT]\n${system}\n[/SYSTEM PROMPT]\n\n` : '';
  const tail = `${history.length ? '[PESAN TERBARU USER]\n' : system ? '[PESAN USER]\n' : ''}${latest}`;
  let room = budget - queryLength(head + tail);
  if (room < 0) return null;
  room -= 200;

  const lines = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const body = partsOf(history[i].content).text;
    const line = `${history[i].role === 'user' ? 'User' : 'Kamu'}: ${body.length > 600 ? `${body.slice(0, 600)} …` : body}`;
    const cost = queryLength(line) + 3;
    if (cost > room) break;
    lines.unshift(line);
    room -= cost;
  }
  const mid = lines.length ? `=== RIWAYAT SINGKAT ===\n${lines.join('\n')}\n\n` : '';
  return head + mid + tail;
}

// Bentuk JSON Nekolabs belum terdokumentasi rapi → dibaca toleran.
const TEXT_PATHS = [
  'result.text',
  'result.response',
  'result.content',
  'result.answer',
  'result.reply',
  'result.output',
  'result.message',
  'result.description',
  'result',
  'data.text',
  'data.response',
  'data.content',
  'data.result',
  'data',
  'response',
  'text',
  'content',
  'answer',
  'reply',
  'output',
  'description',
];

function pick(obj, paths) {
  for (const p of paths) {
    const v = p.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj);
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

function pickError(data) {
  const e = data?.error ?? data?.message;
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object' && typeof e.message === 'string') return e.message;
  return '';
}

function sendSse(res, text) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    ...CORS,
  });
  res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`);
  res.write('data: [DONE]\n\n');
  res.end();
}

async function handleNekolabs({ res, resolved, apiKey, messages, stream, needSearch, deviceId }) {
  const pc = resolved.providerConfig;
  let params;

  if (resolved.supportsVision) {
    // /image/vision?url=…&q=… — hanya URL https (bukan data URL)
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const { text, images } = partsOf(lastUser?.content);
    const image = images.find((u) => /^https:\/\//i.test(u));
    if (!image) return res.status(400).json({ error: 'image_url_required' });
    params = new URLSearchParams({ url: image, q: text || 'Deskripsikan gambar ini.' });
  } else {
    const content = flattenMessages(messages);
    if (content === null) return res.status(413).json({ error: 'too_long' });
    params = new URLSearchParams({ [resolved.queryParam || 'content']: content });
    if (resolved.supportsSearch) {
      params.set('conversationId', '');
      params.set('deviceId', typeof deviceId === 'string' ? deviceId : '');
      params.set('needSearch', needSearch ? '1' : '0');
    }
  }

  let upstream;
  try {
    upstream = await fetch(`${pc.baseUrl}${resolved.endpoint}?${params}`, {
      method: 'GET',
      headers: { 'X-API-Key': apiKey },
    });
  } catch (err) {
    return res.status(502).json({ error: 'upstream_network', detail: err.message });
  }

  const requestId = upstream.headers.get('x-request-id') || '';
  res.setHeader('X-Request-Id', requestId);

  const raw = await upstream.text().catch(() => '');
  let data = null;
  try {
    data = JSON.parse(raw);
  } catch {
    data = null;
  }

  if (!upstream.ok || !data || data.success === false || data.status === false) {
    return res.status(upstream.ok ? 502 : upstream.status).json({
      error: 'upstream',
      detail: (pickError(data) || raw).slice(0, 800),
      requestId,
    });
  }

  const text = pick(data, TEXT_PATHS);
  if (!text) return res.status(502).json({ error: 'empty', requestId });

  if (stream) return sendSse(res, text);
  return res.status(200).json({
    choices: [{ message: { role: 'assistant', content: text } }],
    usage: data.usage || null,
    requestId,
  });
}

async function handleOpenAi({ req, res, resolved, apiKey, messages, stream, max_tokens, temperature }) {
  const pc = resolved.providerConfig;
  const payload = { model: resolved.id, messages, stream: Boolean(stream) };
  if (max_tokens) payload.max_tokens = max_tokens;
  if (temperature !== undefined && temperature !== null) payload.temperature = temperature;

  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
  if (pc.id === 'openrouter') {
    // atribusi opsional OpenRouter
    if (req.headers?.origin) headers['HTTP-Referer'] = req.headers.origin;
    headers['X-Title'] = 'MyAssistants';
  }

  let upstream;
  try {
    upstream = await fetch(`${pc.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return res.status(502).json({ error: 'upstream_network', detail: err.message });
  }

  const requestId = upstream.headers.get('x-request-id') || '';
  res.setHeader('X-Request-Id', requestId);

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '');
    return res.status(upstream.status || 502).json({
      error: 'upstream',
      detail: String(detail).slice(0, 800),
      requestId,
    });
  }

  if (stream) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      ...CORS,
    });
    try {
      for await (const chunk of upstream.body) res.write(chunk);
    } catch {
      /* koneksi klien putus */
    } finally {
      res.end();
    }
    return undefined;
  }

  const data = await upstream.json().catch(() => null);
  if (!data) return res.status(502).json({ error: 'upstream_bad_json', requestId });
  return res.status(200).json({ ...data, requestId });
}

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    provider,
    model,
    messages,
    stream = false,
    vision = false,
    needSearch = false,
    deviceId = '',
    max_tokens,
    temperature,
  } = req.body || {};

  const resolved = resolveModel(`${provider || ''}:${model || ''}`);
  if (!resolved || !resolved.providerConfig) {
    return res.status(400).json({ error: 'unknown_model', detail: `${provider}:${model}` });
  }
  if (vision && !resolved.supportsVision) {
    return res.status(400).json({ error: 'model_not_vision', detail: `${provider}:${model}` });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages_required' });
  }

  const pc = resolved.providerConfig;
  const apiKey = process.env[pc.envKey];
  if (!apiKey) return res.status(500).json({ error: 'missing_env_key', detail: pc.envKey });

  if (pc.api === 'nekolabs') {
    return handleNekolabs({ res, resolved, apiKey, messages, stream, needSearch, deviceId });
  }
  return handleOpenAi({ req, res, resolved, apiKey, messages, stream, max_tokens, temperature });
}
