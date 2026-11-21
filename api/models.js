// GET /api/models — daftar provider & model dari registry.
// hasKey menunjukkan apakah env key provider tersedia di server (tanpa membocorkan key).

import { PROVIDERS, MODELS } from '../src/config/providers.js';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  return res.status(200).json({
    providers: Object.values(PROVIDERS).map((p) => ({
      id: p.id,
      label: p.label,
      contextWindow: p.contextWindow,
      hasKey: Boolean(process.env[p.envKey]),
    })),
    models: MODELS,
  });
}
