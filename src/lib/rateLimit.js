// Rate limit client-side: 5 prompt / 24 jam / device untuk SEMUA mode
// (Chat, Coder, Teleprinter, Vision) — semua dibatasi karena semua
// memakai API key server.
// Data: localStorage { timestamps: [unix_ms, ...] }.

import { getRate, setRate } from './storage';

export const LIMIT = 24;
export const WINDOW_MS = 24 * 60 * 60 * 1000;

export function computeQuota(timestamps, now = Date.now()) {
  const active = timestamps.filter((t) => t > now - WINDOW_MS).sort((a, b) => a - b);
  const used = Math.min(active.length, LIMIT);
  const remaining = Math.max(0, LIMIT - active.length);
  const resetAt =
    active.length >= LIMIT ? active[active.length - LIMIT] + WINDOW_MS : active.length ? active[0] + WINDOW_MS : null;
  return { used, remaining, limit: LIMIT, canSend: remaining > 0, resetAt, activeCount: active.length };
}

export function getQuota(now = Date.now()) {
  return computeQuota(getRate().timestamps, now);
}

// Catat 1 prompt; kembalikan timestamp untuk di-refund kalau request gagal.
export function consumeQuota(now = Date.now()) {
  const fresh = getRate().timestamps.filter((t) => t > now - WINDOW_MS);
  setRate([...fresh, now]);
  return now;
}

export function refundQuota(stamp) {
  const list = [...getRate().timestamps];
  const idx = list.lastIndexOf(stamp);
  if (idx !== -1) list.splice(idx, 1);
  setRate(list);
}

export function resetQuota() {
  setRate([]);
}

export function formatCountdown(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n) => String(n).padStart(2, '0');
  return { h: p(h), m: p(m), s: p(s), text: `${p(h)}:${p(m)}:${p(s)}` };
}
