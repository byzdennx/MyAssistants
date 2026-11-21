// Export / import JSON dengan validasi skema (round-trip aman).

import { snapshot, importData, normalizeSettings } from './storage';
import { downloadFile, dateStamp, slugify } from './utils';
import { snapshotFiles, importProjects, validateFilesPayload } from './files';

export const APP_NAME = 'MyAssistants';
const LEGACY_APP_NAME = 'MyAssistant'; // impor dari versi lama tetap diterima
export const SCHEMA_ALL = 'myassistant.export';
export const SCHEMA_ONE = 'myassistant.conversation';
export const SCHEMA_VERSION = 1;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

/* ── export ───────────────────────────────────────────────── */
export function buildExportAll() {
  const { conversations, settings, activity } = snapshot();
  // API key sengaja tidak ikut diekspor.
  const { devMock: _omitMock, ...safeSettings } = settings;
  return {
    app: APP_NAME,
    schema: SCHEMA_ALL,
    version: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: { conversations, settings: safeSettings, activity, files: snapshotFiles() },
  };
}

export function exportAllToFile() {
  const payload = buildExportAll();
  downloadFile(`myassistant-backup-${dateStamp()}.json`, JSON.stringify(payload, null, 2));
  return payload;
}

export function buildExportOne(conversation) {
  return {
    app: APP_NAME,
    schema: SCHEMA_ONE,
    version: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: { conversations: [conversation] },
  };
}

export function exportConversationJson(conversation) {
  downloadFile(
    `${slugify(conversation.title)}-${dateStamp()}.json`,
    JSON.stringify(buildExportOne(conversation), null, 2),
  );
}

export function conversationToMarkdown(conversation, { youLabel = 'Kamu' } = {}) {
  const lines = [
    `# ${conversation.title || 'Percakapan'}`,
    '',
    `> ${APP_NAME} · mode ${conversation.mode} · dibuat ${new Date(conversation.createdAt).toLocaleString()}`,
    '',
  ];
  conversation.messages.forEach((m) => {
    lines.push(`## ${m.role === 'user' ? youLabel : APP_NAME} — ${new Date(m.ts).toLocaleString()}`, '', m.content, '');
  });
  return lines.join('\n');
}

export function exportConversationMarkdown(conversation, opts) {
  downloadFile(
    `${slugify(conversation.title)}-${dateStamp()}.md`,
    conversationToMarkdown(conversation, opts),
    'text/markdown',
  );
}

/* ── validasi ─────────────────────────────────────────────── */
const fail = (code) => ({ ok: false, code });

export function validateImport(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return fail('schema');
  if (obj.app !== APP_NAME && obj.app !== LEGACY_APP_NAME) return fail('schema');
  if (obj.schema !== SCHEMA_ALL && obj.schema !== SCHEMA_ONE) return fail('schema');
  if (obj.version !== SCHEMA_VERSION) return fail('version');
  const data = obj.data;
  if (!data || typeof data !== 'object' || !Array.isArray(data.conversations)) return fail('conversations');

  let messageCount = 0;
  const seen = new Set();
  for (const c of data.conversations) {
    if (!c || typeof c !== 'object' || typeof c.id !== 'string' || !c.id) return fail('conversation');
    if (c.mode !== 'chat' && c.mode !== 'coder') return fail('conversation');
    if (seen.has(c.id)) return fail('conversation');
    seen.add(c.id);
    if (!Array.isArray(c.messages)) return fail('message');
    for (const m of c.messages) {
      if (!m || typeof m !== 'object') return fail('message');
      if (m.role !== 'user' && m.role !== 'assistant') return fail('message');
      if (typeof m.content !== 'string') return fail('message');
      if (m.ts !== undefined && !Number.isFinite(m.ts)) return fail('message');
    }
    messageCount += c.messages.length;
  }
  if (data.settings !== undefined && (typeof data.settings !== 'object' || data.settings === null || Array.isArray(data.settings))) {
    return fail('settings');
  }
  if (data.activity !== undefined && !Array.isArray(data.activity)) return fail('settings');

  let fileCount = 0;
  if (data.files !== undefined) {
    const v = validateFilesPayload(data.files);
    if (!v.ok) return fail('files');
    fileCount = v.summary.files;
  }

  return { ok: true, summary: { conversations: data.conversations.length, messages: messageCount, files: fileCount } };
}

export async function readImportFile(file) {
  if (file.size > MAX_FILE_BYTES) return fail('size');
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    return fail('json');
  }
  const result = validateImport(parsed);
  if (!result.ok) return result;
  return { ...result, parsed };
}

export function applyImport(parsed, mode = 'merge') {
  const { conversations, settings, activity, files } = parsed.data;
  if (files && Array.isArray(files.projects)) importProjects(files.projects, mode);
  importData(
    {
      conversations: conversations.map((c) => ({
        id: c.id,
        mode: c.mode,
        title: typeof c.title === 'string' ? c.title : '',
        createdAt: Number.isFinite(c.createdAt) ? c.createdAt : Date.now(),
        updatedAt: Number.isFinite(c.updatedAt) ? c.updatedAt : Date.now(),
        serverId: typeof c.serverId === 'string' ? c.serverId : '',
        promptSig: typeof c.promptSig === 'string' ? c.promptSig : '',
        ...(typeof c.projectId === 'string' ? { projectId: c.projectId } : {}),
        messages: c.messages.map((m, i) => ({
          id: typeof m.id === 'string' ? m.id : `${c.id}-${i}`,
          role: m.role,
          content: m.content,
          ts: Number.isFinite(m.ts) ? m.ts : Date.now(),
          ...(m.local ? { local: true } : {}),
          ...(Array.isArray(m.files) ? { files: m.files } : {}),
          ...(typeof m.codeFree === 'string' ? { codeFree: m.codeFree } : {}),
          ...(typeof m.filesProject === 'string' ? { filesProject: m.filesProject } : {}),
        })),
      })),
      settings: settings ? normalizeSettings(settings) : undefined,
      activity: Array.isArray(activity) ? activity.filter((d) => typeof d === 'string') : undefined,
    },
    mode,
  );
}
