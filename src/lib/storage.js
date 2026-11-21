// CRUD percakapan + pengaturan di localStorage. Tidak ada backend.
// Store kecil dengan subscribe() supaya UI ikut berubah (dipakai lewat hooks.js).

import { uid, dayKey } from './utils';
import { DEFAULT_CHAT_MODEL, DEFAULT_CODER_MODEL, DEFAULT_VISION_MODEL, resolveModel } from '../config/providers';
import { deleteAllFiles } from './files';

export const NS = 'ma:v1:';
const KEYS = {
  conversations: NS + 'conversations',
  settings: NS + 'settings',
  rate: NS + 'rate',
  device: NS + 'deviceId',
  activity: NS + 'activity',
  ui: NS + 'ui',
  drafts: NS + 'drafts',
  terminal: NS + 'terminal',
  vision: NS + 'vision',
};

export const DEFAULT_SETTINGS = {
  theme: 'light', // light | dark | sepia
  fontSize: 'md', // sm | md | lg
  lang: 'id', // id | en
  animations: true,
  typewriter: true,
  devMock: false,
  chatModel: DEFAULT_CHAT_MODEL,
  coderModel: DEFAULT_CODER_MODEL,
  visionModel: DEFAULT_VISION_MODEL,
};

const THEMES = ['light', 'dark', 'sepia'];
const SIZES = ['sm', 'md', 'lg'];
const LANGS = ['id', 'en'];

/* ── primitif ─────────────────────────────────────────────── */
const listeners = new Set();
let cache = {};

function emit() {
  listeners.forEach((l) => l());
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readRaw(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeRaw(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/* ── normalisasi ──────────────────────────────────────────── */
function sortConversations(list) {
  return [...list].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function normalizeSettings(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  return {
    theme: THEMES.includes(s.theme) ? s.theme : DEFAULT_SETTINGS.theme,
    fontSize: SIZES.includes(s.fontSize) ? s.fontSize : DEFAULT_SETTINGS.fontSize,
    lang: LANGS.includes(s.lang) ? s.lang : DEFAULT_SETTINGS.lang,
    animations: typeof s.animations === 'boolean' ? s.animations : DEFAULT_SETTINGS.animations,
    typewriter: typeof s.typewriter === 'boolean' ? s.typewriter : DEFAULT_SETTINGS.typewriter,
    devMock: s.devMock === true,
    // model harus ada di registry; kalau model vision masuk ke chatModel → pakai default
    chatModel: resolveModel(s.chatModel) && !resolveModel(s.chatModel).supportsVision ? s.chatModel : DEFAULT_CHAT_MODEL,
    coderModel: resolveModel(s.coderModel) && !resolveModel(s.coderModel).supportsVision ? s.coderModel : DEFAULT_CODER_MODEL,
    visionModel: resolveModel(s.visionModel)?.supportsVision ? s.visionModel : DEFAULT_VISION_MODEL,
  };
}

function normalizeConversation(c) {
  if (!c || typeof c !== 'object' || typeof c.id !== 'string') return null;
  const messages = Array.isArray(c.messages)
    ? c.messages
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .map((m) => ({
          id: typeof m.id === 'string' ? m.id : uid(),
          role: m.role,
          content: m.content,
          ts: Number.isFinite(m.ts) ? m.ts : Date.now(),
          ...(m.local ? { local: true } : {}),
          // lampiran Coder: daftar file yang auto-tersimpan + versi tanpa blok kode
          ...(Array.isArray(m.files) && m.files.length
            ? {
                files: m.files
                  .filter((f) => f && typeof f.path === 'string' && typeof f.content === 'string')
                  .map((f) => ({ path: f.path, content: f.content, ...(Number.isFinite(f.bytes) ? { bytes: f.bytes } : {}) })),
                ...(typeof m.filesProject === 'string' ? { filesProject: m.filesProject } : {}),
              }
            : {}),
          ...(typeof m.codeFree === 'string' ? { codeFree: m.codeFree } : {}),
        }))
    : [];
  const created = Number.isFinite(c.createdAt) ? c.createdAt : Date.now();
  return {
    id: c.id,
    mode: c.mode === 'coder' ? 'coder' : 'chat',
    title: typeof c.title === 'string' ? c.title : '',
    createdAt: created,
    updatedAt: Number.isFinite(c.updatedAt) ? c.updatedAt : created,
    serverId: typeof c.serverId === 'string' ? c.serverId : '',
    promptSig: typeof c.promptSig === 'string' ? c.promptSig : '',
    ...(typeof c.projectId === 'string' ? { projectId: c.projectId } : {}),
    messages,
  };
}

function load(name) {
  if (name in cache) return cache[name];
  let value;
  switch (name) {
    case 'conversations': {
      const raw = readRaw(KEYS.conversations, []);
      value = sortConversations((Array.isArray(raw) ? raw : []).map(normalizeConversation).filter(Boolean));
      break;
    }
    case 'settings':
      value = normalizeSettings(readRaw(KEYS.settings, null));
      break;
    case 'rate': {
      const raw = readRaw(KEYS.rate, null);
      const ts = raw && Array.isArray(raw.timestamps) ? raw.timestamps.filter((n) => Number.isFinite(n)) : [];
      value = { timestamps: ts };
      break;
    }
    case 'activity': {
      const raw = readRaw(KEYS.activity, []);
      value = Array.isArray(raw) ? raw.filter((d) => typeof d === 'string') : [];
      break;
    }
    case 'ui': {
      const raw = readRaw(KEYS.ui, {});
      value = raw && typeof raw === 'object' ? raw : {};
      break;
    }
    case 'terminal': {
      const raw = readRaw(KEYS.terminal, {});
      value = raw && typeof raw === 'object' ? raw : {};
      break;
    }
    case 'drafts': {
      const raw = readRaw(KEYS.drafts, {});
      value = raw && typeof raw === 'object' ? raw : {};
      break;
    }
    case 'vision': {
      const raw = readRaw(KEYS.vision, []);
      value = Array.isArray(raw) ? raw : [];
      break;
    }
    default:
      value = null;
  }
  cache[name] = value;
  return value;
}

function commit(name, value, { silent = false } = {}) {
  cache[name] = value;
  const ok = writeRaw(KEYS[name], value);
  if (!silent) emit();
  return ok;
}

// sinkron antar-tab
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith(NS)) {
      cache = {};
      emit();
    }
  });
}

/* ── conversations ────────────────────────────────────────── */
export function getConversations() {
  return load('conversations');
}

export function getConversation(id) {
  return load('conversations').find((c) => c.id === id) || null;
}

export function createConversation({ mode = 'chat', title = '' } = {}) {
  const now = Date.now();
  const conv = {
    id: uid(),
    mode: mode === 'coder' ? 'coder' : 'chat',
    title,
    createdAt: now,
    updatedAt: now,
    serverId: '',
    promptSig: '',
    projectId: '',
    messages: [],
  };
  commit('conversations', sortConversations([conv, ...load('conversations')]));
  return conv;
}

export function patchConversation(id, patch) {
  const list = load('conversations');
  const idx = list.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  const current = list[idx];
  const next = { ...current, ...(typeof patch === 'function' ? patch(current) : patch) };
  const copy = [...list];
  copy[idx] = next;
  commit('conversations', sortConversations(copy));
  return next;
}

export function appendMessage(id, message) {
  return patchConversation(id, (c) => ({ messages: [...c.messages, message], updatedAt: Date.now() }));
}

export function deleteConversation(id) {
  commit(
    'conversations',
    load('conversations').filter((c) => c.id !== id),
  );
}

export function deleteAllConversations() {
  commit('conversations', []);
}

/* ── settings ─────────────────────────────────────────────── */
export function getSettings() {
  return load('settings');
}

export function updateSettings(patch) {
  const next = normalizeSettings({ ...load('settings'), ...patch });
  commit('settings', next);
  return next;
}

/* ── rate limit state ─────────────────────────────────────── */
export function getRate() {
  return load('rate');
}

export function setRate(timestamps) {
  commit('rate', { timestamps });
}

/* ── activity (streak) ────────────────────────────────────── */
export function getActivity() {
  return load('activity');
}

export function recordActivity() {
  const today = dayKey();
  const list = load('activity');
  if (list.includes(today)) return;
  commit('activity', [...list, today].slice(-400));
}

export function computeStreak(days, now = Date.now()) {
  const set = new Set(days);
  let cursor = new Date(now);
  // hari ini boleh belum aktif — streak tetap hidup kalau kemarin aktif
  if (!set.has(dayKey(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1);
  let n = 0;
  while (set.has(dayKey(cursor.getTime()))) {
    n++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return n;
}

/* ── ui prefs & drafts (cache, aman dibersihkan) ──────────── */
export function getUi() {
  return load('ui');
}

export function setUi(patch) {
  commit('ui', { ...load('ui'), ...patch });
}

export function getDraft(key) {
  return load('drafts')[key] || '';
}

export function setDraft(key, text) {
  const drafts = { ...load('drafts') };
  if (text) drafts[key] = text;
  else delete drafts[key];
  commit('drafts', drafts, { silent: true });
}

/* ── ingatan Teleprinter (per proyek, maks 40 giliran) ───── */
export const TERMINAL_MEMORY_LIMIT = 40;

export function getTerminalMemory(projectId) {
  if (!projectId) return [];
  const list = load('terminal')[projectId];
  return Array.isArray(list)
    ? list.filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    : [];
}

export function appendTerminalTurns(projectId, turns) {
  if (!projectId || !turns.length) return;
  const all = { ...load('terminal') };
  all[projectId] = [...getTerminalMemory(projectId), ...turns].slice(-TERMINAL_MEMORY_LIMIT);
  commit('terminal', all, { silent: true });
}

export function clearTerminalMemory(projectId) {
  const all = { ...load('terminal') };
  delete all[projectId];
  commit('terminal', all, { silent: true });
}

/* ── vision conversations (sederhana: {id,title,createdAt,updatedAt,messages:[{id,role,content,images,ts,meta}]}) ── */
export function getVisionConversations() {
  return [...load('vision')].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function getVisionConversation(id) {
  return load('vision').find((c) => c.id === id) || null;
}

export function createVisionConversation(title = '') {
  const now = Date.now();
  const conv = { id: uid(), title, createdAt: now, updatedAt: now, messages: [] };
  commit('vision', [conv, ...load('vision')]);
  return conv;
}

export function patchVisionConversation(id, patch) {
  const list = load('vision');
  const idx = list.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  const copy = [...list];
  copy[idx] = { ...copy[idx], ...(typeof patch === 'function' ? patch(copy[idx]) : patch), updatedAt: Date.now() };
  commit('vision', copy);
  return copy[idx];
}

export function appendVisionMessage(id, message) {
  return patchVisionConversation(id, (c) => ({ messages: [...c.messages, message] }));
}

export function deleteVisionConversation(id) {
  commit('vision', load('vision').filter((c) => c.id !== id));
}

export function deleteAllVision() {
  commit('vision', []);
}

/* ── device id ────────────────────────────────────────────── */
export function getDeviceId() {
  let id = readRaw(KEYS.device, null);
  if (typeof id !== 'string' || !id) {
    id = uid();
    writeRaw(KEYS.device, id);
  }
  return id;
}

/* ── manager ──────────────────────────────────────────────── */
export function snapshot() {
  return {
    conversations: load('conversations'),
    settings: load('settings'),
    activity: load('activity'),
  };
}

export function importData(data, mode = 'merge') {
  let conversations;
  if (mode === 'replace') {
    conversations = data.conversations;
  } else {
    const map = new Map(load('conversations').map((c) => [c.id, c]));
    data.conversations.forEach((c) => {
      const existing = map.get(c.id);
      if (!existing || (c.updatedAt || 0) >= (existing.updatedAt || 0)) map.set(c.id, c);
    });
    conversations = [...map.values()];
  }
  commit('conversations', sortConversations(conversations));

  if (data.settings) {
    const cur = load('settings');
    commit('settings', normalizeSettings({ ...cur, ...data.settings, devMock: cur.devMock }));
  }
  if (Array.isArray(data.activity)) {
    const merged = [...new Set([...(mode === 'replace' ? [] : load('activity')), ...data.activity])].sort();
    commit('activity', merged.slice(-400));
  }
}

export async function clearCache() {
  try {
    sessionStorage.clear();
  } catch {
    /* abaikan */
  }
  try {
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
  } catch {
    /* abaikan */
  }
  commit('drafts', {}, { silent: true });
  commit('ui', {});
}

export function deleteEverything() {
  // Semua data termasuk File Manager. Kuota harian sengaja TIDAK ikut dihapus supaya batas 5x/24 jam tetap jujur.
  const keepRate = load('rate');
  const toRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(NS) && k !== KEYS.rate) toRemove.push(k);
  }
  toRemove.forEach((k) => localStorage.removeItem(k));
  deleteAllFiles(); // myassistant_files ikut dihapus
  try {
    sessionStorage.clear();
  } catch {
    /* abaikan */
  }
  cache = {};
  cache.rate = keepRate;
  emit();
}

export function storageUsage() {
  let bytes = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith(NS) || k === 'myassistant_files')) bytes += (k.length + (localStorage.getItem(k) || '').length) * 2;
    }
  } catch {
    /* abaikan */
  }
  return bytes;
}
