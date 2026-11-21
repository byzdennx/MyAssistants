// Vercel Serverless Function — alat gambar Nekolabs (restore / enhance / rembg).
// POST /api/image  { tool, url, upscale?, background? }
//   → GET {baseUrl}{endpoint}?url=…[&upscale=…][&background=…]  (X-API-Key dari env)
//   ← { url, requestId }   url = gambar hasil (URL https atau data URL)
// Hanya menerima URL gambar https; key tidak pernah dikirim ke browser.

import { IMAGE_TOOLS, PROVIDERS, UPSCALE_VALUES } from '../src/config/providers.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const IMAGE_LIKE = /^(https?:\/\/|data:image\/)/i;

// Kumpulkan semua string mirip URL gambar dari JSON (bentuk respons dibaca toleran).
function collectImageUrls(value, out = [], depth = 0) {
  if (typeof value === 'string') {
    if (IMAGE_LIKE.test(value.trim())) out.push(value.trim());
  } else if (value && typeof value === 'object' && depth < 6) {
    Object.values(value).forEach((v) => collectImageUrls(v, out, depth + 1));
  }
  return out;
}

function pickError(data) {
  const e = data?.error ?? data?.message;
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object' && typeof e.message === 'string') return e.message;
  return '';
}

export default async function handler(req, res) {
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { tool, url, upscale, background } = req.body || {};
  const def = IMAGE_TOOLS.find((t) => t.id === tool);
  if (!def) return res.status(400).json({ error: 'unknown_tool', detail: String(tool) });
  if (typeof url !== 'string' || !/^https:\/\/\S+$/i.test(url.trim())) {
    return res.status(400).json({ error: 'bad_image_url' });
  }

  const pc = PROVIDERS[def.provider];
  const apiKey = process.env[pc.envKey];
  if (!apiKey) return res.status(500).json({ error: 'missing_env_key', detail: pc.envKey });

  const source = url.trim();
  const params = new URLSearchParams({ url: source });
  if (def.options.includes('upscale')) {
    params.set('upscale', String(UPSCALE_VALUES.includes(Number(upscale)) ? Number(upscale) : UPSCALE_VALUES[0]));
  }
  if (def.options.includes('background')) params.set('background', background === false ? '0' : '1');

  let upstream;
  try {
    upstream = await fetch(`${pc.baseUrl}${def.endpoint}?${params}`, {
      method: 'GET',
      headers: { 'X-API-Key': apiKey },
    });
  } catch (err) {
    return res.status(502).json({ error: 'upstream_network', detail: err.message });
  }

  const requestId = upstream.headers.get('x-request-id') || '';
  res.setHeader('X-Request-Id', requestId);
  const type = (upstream.headers.get('content-type') || '').toLowerCase();

  // Respons berupa gambar langsung → kembalikan sebagai data URL
  if (upstream.ok && type.startsWith('image/')) {
    const buffer = Buffer.from(await upstream.arrayBuffer());
    return res.status(200).json({ url: `data:${type.split(';')[0]};base64,${buffer.toString('base64')}`, requestId });
  }

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

  // utamakan URL yang bukan gambar sumber (beberapa API mengulang input di respons)
  const found = collectImageUrls(data);
  const result = found.find((u) => u !== source) || found[0];
  if (!result) return res.status(502).json({ error: 'empty', requestId });
  return res.status(200).json({ url: result, requestId });
}
