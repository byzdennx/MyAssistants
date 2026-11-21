import clsx from 'clsx';

export const cx = clsx;

export function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function pad2(n) {
  return String(n).padStart(2, '0');
}

export function truncate(str, n) {
  const s = String(str || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n).trimEnd() + '…' : s;
}

export function slugify(str) {
  return (
    String(str || 'percakapan')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'percakapan'
  );
}

export function contentBytes(str) {
  return new TextEncoder().encode(String(str || '')).length;
}

// Batas 250 MB per proyek / per percakapan (sesuai spesifikasi).
export const MAX_ENTITY_BYTES = 250 * 1024 * 1024;

export function formatBytes(n) {
  if (!n) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function hashString(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return String(h >>> 0);
}

export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* jatuh ke fallback */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function downloadFile(filename, content, mime = 'application/json') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function dateStamp(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}`;
}

export function dayKey(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function relativeTime(ts, lang = 'id', now = Date.now()) {
  const diff = ts - now;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(lang === 'en' ? 'en' : 'id', { numeric: 'auto' });
  if (abs < 45 * 1000) return lang === 'en' ? 'just now' : 'baru saja';
  if (abs < 60 * 60 * 1000) return rtf.format(Math.round(diff / 60000), 'minute');
  if (abs < 24 * 60 * 60 * 1000) return rtf.format(Math.round(diff / 3600000), 'hour');
  if (abs < 30 * 24 * 60 * 60 * 1000) return rtf.format(Math.round(diff / 86400000), 'day');
  return new Date(ts).toLocaleDateString(lang === 'en' ? 'en-US' : 'id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTime(ts, lang = 'id') {
  return new Date(ts).toLocaleTimeString(lang === 'en' ? 'en-US' : 'id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ?dev=1 di URL (mis. /profile/manager?dev=1). Diingat per sesi tab supaya tetap aktif setelah navigasi.
export function isDevMode() {
  try {
    const fromSearch = new URLSearchParams(window.location.search).get('dev') === '1';
    if (fromSearch) sessionStorage.setItem('ma:dev', '1');
    return fromSearch || sessionStorage.getItem('ma:dev') === '1';
  } catch {
    return false;
  }
}

// Terapkan pengaturan tampilan ke <html>.
export function applySettingsToDom(settings) {
  const el = document.documentElement;
  el.dataset.theme = settings.theme;
  el.dataset.fs = settings.fontSize;
  el.dataset.motion = settings.animations ? 'on' : 'off';
  el.lang = settings.lang === 'en' ? 'en' : 'id';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', { light: '#F4EDE4', sepia: '#E6D7BB', dark: '#18120D' }[settings.theme] || '#F4EDE4');
}
