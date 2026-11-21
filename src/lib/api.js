// Client API — SELURUH request ke provider lewat proxy server /api/chat.
// API key tidak pernah ada di sini. Mendukung streaming SSE (onChunk per delta)
// dan mengembalikan usage + x-request-id untuk ditampilkan di UI.

import { getDeviceId, getSettings } from './storage';
import { resolveModel } from '../config/providers';
import { isDevMode } from './utils';

export class ApiError extends Error {
  constructor(code, detail = '') {
    super(detail || code);
    this.code = code;
    this.detail = detail;
  }
}

// Batas ukuran payload (riwayat dipangkas di truncateHistory).
export const MAX_PAYLOAD_CHARS = 220000;

export function encodedLength(str) {
  return new URLSearchParams({ c: str }).toString().length - 2;
}

// Batasi riwayat yang dikirim (dari giliran terbaru), dalam "karakter ter-encode".
export function truncateHistory(messages, budget = 48000) {
  const kept = [];
  let used = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const cost = encodedLength(messages[i].content) + 20;
    if (used + cost > budget) break;
    kept.unshift(messages[i]);
    used += cost;
  }
  return kept;
}

function parseSseError(status, body) {
  try {
    const j = JSON.parse(body);
    if (j?.error === 'model_not_vision') return new ApiError('model_not_vision', j.detail || '');
    if (j?.error === 'missing_env_key') return new ApiError('missing_env_key', j.detail || '');
    if (j?.error === 'unknown_model') return new ApiError('unknown_model', j.detail || '');
    if (j?.error) return new ApiError(j.error, j.detail || '');
  } catch {
    /* bukan JSON */
  }
  if (status === 401 || status === 403) return new ApiError('upstream_auth', body.slice(0, 200));
  if (status === 429) return new ApiError('upstream_rate', body.slice(0, 200));
  return new ApiError('upstream', body.slice(0, 200));
}

/**
 * chatCompletion({ modelKey, messages, stream, vision, signal, onChunk, max_tokens })
 * → { text, usage, requestId }
 */
export async function chatCompletion({ modelKey, messages, stream = true, vision = false, needSearch = false, signal, onChunk, max_tokens }) {
  const resolved = resolveModel(modelKey);
  if (!resolved) throw new ApiError('unknown_model', String(modelKey));

  const settings = getSettings();
  if (settings.devMock && isDevMode()) {
    await new Promise((r) => setTimeout(r, 700));
    const text = vision ? MOCK_VISION_TEXT : MOCK_CHAT_TEXT;
    if (stream && onChunk) {
      for (let i = 0; i < text.length; i += 24) onChunk(text.slice(i, i + 24));
    }
    return { text, usage: { prompt_tokens: 12, completion_tokens: 34 }, requestId: 'mock-' + Date.now() };
  }

  const body = {
    provider: resolved.provider,
    model: resolved.id,
    messages,
    stream: Boolean(stream),
    vision: Boolean(vision),
    needSearch: Boolean(needSearch && resolved.supportsSearch),
    deviceId: getDeviceId(),
  };
  if (max_tokens) body.max_tokens = max_tokens;
  if (encodedLength(JSON.stringify(body)) > MAX_PAYLOAD_CHARS) throw new ApiError('too_long');

  let res;
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw new ApiError('aborted');
    throw new ApiError('network');
  }

  const requestId = res.headers.get('x-request-id') || '';

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw parseSseError(res.status, text);
  }

  if (!stream) {
    const data = await res.json().catch(() => null);
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) throw new ApiError('empty');
    return { text: text.trim(), usage: data?.usage || null, requestId };
  }

  // ── streaming SSE ──
  if (!res.body) throw new ApiError('no_stream');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  let usage = null;
  let done = false;

  const handleBlock = (block) => {
    for (const line of block.split('\n')) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') {
        if (data === '[DONE]') done = true;
        continue;
      }
      try {
        const json = JSON.parse(data);
        const delta = json?.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta) {
          text += delta;
          onChunk?.(delta);
        }
        if (json?.usage) usage = json.usage;
      } catch {
        /* abaikan chunk rusak */
      }
    }
  };

  try {
    for (;;) {
      const { done: readerDone, value } = await reader.read();
      if (readerDone) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        handleBlock(buffer.slice(0, idx));
        buffer = buffer.slice(idx + 2);
      }
      if (done) break;
    }
    if (buffer.trim()) handleBlock(buffer);
  } finally {
    reader.releaseLock();
  }

  if (!text.trim()) throw new ApiError('empty');
  return { text, usage, requestId };
}

/**
 * Alat gambar Nekolabs lewat /api/image → { url, requestId }.
 * tool: 'restore' | 'enhance' | 'rembg'; url harus https.
 */
export async function runImageTool({ tool, url, upscale, background, signal }) {
  const settings = getSettings();
  if (settings.devMock && isDevMode()) {
    await new Promise((r) => setTimeout(r, 700));
    return { url, requestId: 'mock-' + Date.now() };
  }
  let res;
  try {
    res = await fetch('/api/image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool, url, upscale, background }),
      signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw new ApiError('aborted');
    throw new ApiError('network');
  }
  const text = await res.text().catch(() => '');
  if (!res.ok) throw parseSseError(res.status, text);
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }
  if (!data?.url) throw new ApiError('empty');
  return { url: data.url, requestId: data.requestId || res.headers.get('x-request-id') || '' };
}

// Pesan error untuk user (satu tempat untuk semua halaman).
export function describeError(t, err) {
  const code = err?.code || 'unknown';
  const key = `error.${code}`;
  const base = t(key) === key ? t('error.unknown') : t(key);
  const showDetail = (code === 'upstream' || code === 'missing_env_key') && err?.detail;
  return showDetail ? `${base} (${String(err.detail).slice(0, 160)})` : base;
}

const MOCK_CHAT_TEXT =
  'Ini respons tiruan (mode dev). Kalau sudah deploy dengan env key, pesan ini datang dari provider lewat /api/chat.';
const MOCK_VISION_TEXT =
  'Ini respons tiruan untuk mode vision. Gambar kamu akan dikirim sebagai `image_url` (data URL atau URL https) dalam format konten standar OpenAI.';
