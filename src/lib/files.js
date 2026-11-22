// File Manager — CRUD project & file di localStorage (key: myassistant_files).
//
// {
//   "projects": [
//     { "id": "uuid", "name": "Landing Kopi", "createdAt": 0, "updatedAt": 0,
//       "files": [ { "path": "src/App.jsx", "content": "...", "updatedAt": 0 } ] }
//   ]
// }

import { uid, downloadFile, dateStamp, slugify, contentBytes, MAX_ENTITY_BYTES } from './utils';

export const FILES_KEY = 'myassistant_files';

// Batas 250 MB per proyek.
export const MAX_PROJECT_BYTES = MAX_ENTITY_BYTES;

export function projectBytes(p) {
  return (p?.files || []).reduce((n, f) => n + contentBytes(f.content), 0);
}

function assertSize(project) {
  if (projectBytes(project) > MAX_PROJECT_BYTES) throw new FilesError('too_large');
}
export const SCHEMA_FILES = 'myassistant.files';
export const SCHEMA_PROJECT = 'myassistant.project';
const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

export class FilesError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

/* ── store ────────────────────────────────────────────────── */
const listeners = new Set();
let cache = null;

function emit() {
  listeners.forEach((l) => l());
}

export function subscribeFiles(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === FILES_KEY || e.key === null) {
      cache = null;
      emit();
    }
  });
}

/* ── normalisasi ──────────────────────────────────────────── */
// "./src//App.jsx" → "src/App.jsx". Menolak path kosong & "..".
export function normalizePath(path) {
  const parts = String(path || '')
    .replace(/\\/g, '/')
    .split('/')
    .map((p) => p.trim())
    .filter((p) => p && p !== '.');
  if (!parts.length || parts.some((p) => p === '..')) return '';
  return parts.join('/');
}

function normalizeFile(f) {
  if (!f || typeof f !== 'object') return null;
  const path = normalizePath(f.path);
  if (!path || typeof f.content !== 'string') return null;
  return { path, content: f.content, updatedAt: Number.isFinite(f.updatedAt) ? f.updatedAt : Date.now() };
}

function sortFiles(files) {
  return [...files].sort((a, b) => a.path.localeCompare(b.path));
}

function normalizeProject(p) {
  if (!p || typeof p !== 'object') return null;
  const name = typeof p.name === 'string' && p.name.trim() ? p.name.trim().slice(0, 80) : 'Proyek tanpa nama';
  const seen = new Set();
  const files = (Array.isArray(p.files) ? p.files : [])
    .map(normalizeFile)
    .filter(Boolean)
    .filter((f) => (seen.has(f.path) ? false : (seen.add(f.path), true)));
  const created = Number.isFinite(p.createdAt) ? p.createdAt : Date.now();
  return {
    id: typeof p.id === 'string' && p.id ? p.id : uid(),
    name,
    createdAt: created,
    updatedAt: Number.isFinite(p.updatedAt) ? p.updatedAt : created,
    files: sortFiles(files),
  };
}

function sortProjects(list) {
  return [...list].sort((a, b) => b.updatedAt - a.updatedAt);
}

function load() {
  if (cache) return cache;
  let raw = null;
  try {
    raw = JSON.parse(localStorage.getItem(FILES_KEY) || 'null');
  } catch {
    raw = null;
  }
  const projects = raw && Array.isArray(raw.projects) ? raw.projects.map(normalizeProject).filter(Boolean) : [];
  cache = { projects: sortProjects(projects) };
  return cache;
}

function commit(projects) {
  cache = { projects: sortProjects(projects) };
  try {
    localStorage.setItem(FILES_KEY, JSON.stringify(cache));
  } catch {
    emit();
    throw new FilesError('quota');
  }
  emit();
  return cache;
}

/* ── baca ─────────────────────────────────────────────────── */
export function getFilesState() {
  return load();
}

export function getProjects() {
  return load().projects;
}

export function getProject(id) {
  return load().projects.find((p) => p.id === id) || null;
}

export function findProjectByName(name) {
  const n = String(name || '').trim().toLowerCase();
  return load().projects.find((p) => p.name.toLowerCase() === n) || null;
}

export function countFiles(state = load()) {
  return state.projects.reduce((n, p) => n + p.files.length, 0);
}

function uniqueName(name, exceptId) {
  const base = String(name || '').trim().slice(0, 80) || 'Proyek baru';
  const taken = new Set(load().projects.filter((p) => p.id !== exceptId).map((p) => p.name.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  let i = 2;
  while (taken.has(`${base} (${i})`.toLowerCase())) i++;
  return `${base} (${i})`;
}

function mutateProject(id, fn) {
  const list = load().projects;
  const idx = list.findIndex((p) => p.id === id);
  if (idx === -1) throw new FilesError('no_project');
  const next = fn(list[idx]);
  const copy = [...list];
  copy[idx] = { ...next, updatedAt: Date.now() };
  commit(copy);
  return copy[idx];
}

/* ── project CRUD ─────────────────────────────────────────── */
// Cari proyek berdasarkan nama; buat kosong kalau belum ada.
export function ensureProjectByName(name) {
  return findProjectByName(name) || createProject(name);
}

export function createProject(name) {
  const now = Date.now();
  const project = { id: uid(), name: uniqueName(name), createdAt: now, updatedAt: now, files: [] };
  commit([project, ...load().projects]);
  return project;
}

export function renameProject(id, name) {
  if (!String(name || '').trim()) throw new FilesError('empty_name');
  return mutateProject(id, (p) => ({ ...p, name: uniqueName(name, id) }));
}

export function deleteProject(id) {
  commit(load().projects.filter((p) => p.id !== id));
}

export function deleteAllFiles() {
  cache = { projects: [] };
  try {
    localStorage.removeItem(FILES_KEY);
  } catch {
    /* abaikan */
  }
  emit();
}

/* ── file CRUD ────────────────────────────────────────────── */
export function createFile(projectId, path, content = '') {
  const clean = normalizePath(path);
  if (!clean) throw new FilesError('bad_path');
  return mutateProject(projectId, (p) => {
    if (p.files.some((f) => f.path === clean)) throw new FilesError('exists');
    const next = { ...p, files: sortFiles([...p.files, { path: clean, content, updatedAt: Date.now() }]) };
    assertSize(next);
    return next;
  });
}

export function updateFile(projectId, path, content) {
  return mutateProject(projectId, (p) => {
    const idx = p.files.findIndex((f) => f.path === path);
    if (idx === -1) throw new FilesError('no_file');
    const files = [...p.files];
    files[idx] = { ...files[idx], content, updatedAt: Date.now() };
    const next = { ...p, files };
    assertSize(next);
    return next;
  });
}

export function renameFile(projectId, oldPath, newPath) {
  const clean = normalizePath(newPath);
  if (!clean) throw new FilesError('bad_path');
  if (clean === oldPath) return getProject(projectId);
  return mutateProject(projectId, (p) => {
    if (p.files.some((f) => f.path === clean)) throw new FilesError('exists');
    return {
      ...p,
      files: sortFiles(p.files.map((f) => (f.path === oldPath ? { ...f, path: clean, updatedAt: Date.now() } : f))),
    }; // rename tidak mengubah ukuran
  });
}

export function deleteFile(projectId, path) {
  return mutateProject(projectId, (p) => ({ ...p, files: p.files.filter((f) => f.path !== path) }));
}

/**
 * Simpan satu file ke project berdasarkan NAMA. Project dibuat otomatis kalau belum ada.
 * File dengan path sama ditimpa.
 */
export function saveFileToProject({ projectName, path, content }) {
  return saveFilesToProject({ projectName, files: [{ path, content }] });
}

export function saveFilesToProject({ projectName, files }) {
  const clean = files
    .map((f) => ({ path: normalizePath(f.path), content: String(f.content ?? '') }))
    .filter((f) => f.path);
  if (!clean.length) throw new FilesError('bad_path');

  let project = findProjectByName(projectName);
  if (!project) project = createProject(projectName);

  let created = 0;
  let overwritten = 0;
  const saved = mutateProject(project.id, (p) => {
    const map = new Map(p.files.map((f) => [f.path, f]));
    const now = Date.now();
    clean.forEach((f) => {
      if (map.has(f.path)) overwritten++;
      else created++;
      map.set(f.path, { path: f.path, content: f.content, updatedAt: now });
    });
    const next = { ...p, files: sortFiles([...map.values()]) };
    assertSize(next);
    return next;
  });
  return { project: saved, created, overwritten, paths: clean.map((f) => f.path) };
}

/* ── tree ─────────────────────────────────────────────────── */
// Path "src/components/Button.jsx" → folder bertingkat. Folder di atas file, urut abjad.
export function buildTree(files) {
  const root = { type: 'folder', name: '', path: '', children: [] };
  for (const f of files) {
    const parts = f.path.split('/');
    let node = root;
    parts.forEach((part, i) => {
      const isFile = i === parts.length - 1;
      const childPath = parts.slice(0, i + 1).join('/');
      if (isFile) {
        node.children.push({ type: 'file', name: part, path: f.path, file: f });
      } else {
        let next = node.children.find((c) => c.type === 'folder' && c.name === part);
        if (!next) {
          next = { type: 'folder', name: part, path: childPath, children: [] };
          node.children.push(next);
        }
        node = next;
      }
    });
  }
  const sort = (node) => {
    node.children.sort((a, b) => (a.type !== b.type ? (a.type === 'folder' ? -1 : 1) : a.name.localeCompare(b.name)));
    node.children.forEach((c) => c.type === 'folder' && sort(c));
  };
  sort(root);
  return root;
}

/* ── deteksi multi-file dari code block ───────────────────── */
// Baris komentar yang HANYA berisi path: // src/App.jsx · # app.py · <!-- index.html --> · /* style.css */
const PATH_LINE =
  /^\s*(?:\/\/|#|--|;|\/\*|<!--|\{\/\*)\s*(?:file(?:name)?\s*:\s*|path\s*:\s*)?((?:[\w@.-]+\/)*[\w@.-]+\.[A-Za-z0-9]{1,10})\s*(?:\*\/\}?|-->)?\s*$/;

export function matchPathLine(line) {
  const m = String(line).match(PATH_LINE);
  if (!m) return '';
  const p = normalizePath(m[1]);
  // hindari salah tangkap versi seperti "v1.2" atau angka saja
  return p && /[A-Za-z]/.test(p.split('.').slice(0, -1).join('.')) ? p : '';
}

/**
 * Pecah isi code block menjadi file berdasarkan komentar path.
 * Mengembalikan [] kalau tidak ada penanda path di baris pertama (setelah baris kosong).
 * Baris penanda path tidak ikut disimpan.
 */
export function splitMultiFile(code) {
  const lines = String(code).replace(/\r\n/g, '\n').split('\n');
  const firstIdx = lines.findIndex((l) => l.trim() !== '');
  if (firstIdx === -1 || !matchPathLine(lines[firstIdx])) return [];
  const files = [];
  let current = null;
  for (let i = firstIdx; i < lines.length; i++) {
    const p = matchPathLine(lines[i]);
    if (p) {
      if (current) files.push(current);
      current = { path: p, lines: [] };
    } else if (current) {
      current.lines.push(lines[i]);
    }
  }
  if (current) files.push(current);
  return files.map((f) => {
    const body = f.lines.join('\n').replace(/^\n+/, '').replace(/\s+$/, '');
    return { path: f.path, content: body + '\n' };
  });
}

const EXT = {
  javascript: 'js', js: 'js', jsx: 'jsx', typescript: 'ts', ts: 'ts', tsx: 'tsx', html: 'html', xml: 'xml',
  css: 'css', scss: 'scss', json: 'json', bash: 'sh', sh: 'sh', shell: 'sh', python: 'py', py: 'py',
  markdown: 'md', md: 'md', sql: 'sql', yaml: 'yml', yml: 'yml', php: 'php', java: 'java', go: 'go',
  rust: 'rs', c: 'c', cpp: 'cpp', vue: 'vue', svelte: 'svelte', toml: 'toml', ini: 'ini', env: 'env',
};

export function extForLang(lang) {
  return EXT[String(lang || '').toLowerCase()] || 'txt';
}

/**
 * File-file dari satu code block:
 *  - ada penanda path di dalamnya → pecah per file
 *  - ada nama file di info fence (```css style.css) → satu file
 *  - selain itu → satu file dengan nama saran (snippet.ext)
 */
export function filesFromBlock({ code, lang, filename }) {
  const split = splitMultiFile(code);
  if (split.length) return { files: split, named: true };
  if (filename) return { files: [{ path: normalizePath(filename) || filename, content: code }], named: true };
  const inferredName = String(lang || '').match(/[\w.-]+\.[a-z0-9]{1,8}/i)?.[0];
  const path = normalizePath(inferredName || '') || `generated.${extForLang(lang)}`;
  return { files: [{ path, content: code }], named: Boolean(inferredName) };
}

/* ── export ───────────────────────────────────────────────── */
function stripProject(p) {
  return { id: p.id, name: p.name, createdAt: p.createdAt, updatedAt: p.updatedAt, files: p.files };
}

export function exportProjectJson(project) {
  const payload = {
    app: 'MyAssistants',
    schema: SCHEMA_PROJECT,
    version: 1,
    exportedAt: new Date().toISOString(),
    project: stripProject(project),
  };
  downloadFile(`${slugify(project.name)}-${dateStamp()}.json`, JSON.stringify(payload, null, 2));
}

export function exportAllFilesJson() {
  const payload = {
    app: 'MyAssistants',
    schema: SCHEMA_FILES,
    version: 1,
    exportedAt: new Date().toISOString(),
    projects: load().projects.map(stripProject),
  };
  downloadFile(`myassistant-files-${dateStamp()}.json`, JSON.stringify(payload, null, 2));
}

export async function exportProjectZip(project) {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const folder = zip.folder(slugify(project.name));
  project.files.forEach((f) => folder.file(f.path, f.content));
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slugify(project.name)}-${dateStamp()}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadSingleFile(file) {
  const name = file.path.split('/').pop() || 'file.txt';
  downloadFile(name, file.content, 'text/plain');
}

/* ── import ───────────────────────────────────────────────── */
// Terima: ekspor semua files, ekspor satu project, atau { projects: [...] } polos.
export function validateFilesPayload(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, code: 'schema' };
  if (obj.app !== 'MyAssistants' && obj.app !== 'MyAssistant') return { ok: false, code: 'schema' };
  let projects;
  if (obj.schema === SCHEMA_PROJECT && obj.project) projects = [obj.project];
  else if (Array.isArray(obj.projects)) projects = obj.projects;
  else if (obj.data && obj.data.files && Array.isArray(obj.data.files.projects)) projects = obj.data.files.projects;
  else return { ok: false, code: 'schema' };

  let fileCount = 0;
  for (const p of projects) {
    if (!p || typeof p !== 'object' || typeof p.name !== 'string' || !Array.isArray(p.files)) return { ok: false, code: 'project' };
    for (const f of p.files) {
      if (!f || typeof f.path !== 'string' || typeof f.content !== 'string' || !normalizePath(f.path)) {
        return { ok: false, code: 'file' };
      }
    }
    fileCount += p.files.length;
  }
  return { ok: true, projects, summary: { projects: projects.length, files: fileCount } };
}

export async function readFilesImport(file) {
  if (file.size > MAX_IMPORT_BYTES) return { ok: false, code: 'size' };
  let parsed;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    return { ok: false, code: 'json' };
  }
  return validateFilesPayload(parsed);
}

// mode 'merge': project dengan id sama digabung per file (yang baru menang); id baru ditambahkan.
// mode 'replace': seluruh isi File Manager diganti.
export function importProjects(projects, mode = 'merge') {
  const incoming = projects.map(normalizeProject).filter(Boolean);
  for (const p of incoming) assertSize(p);
  if (mode === 'replace') return commit(incoming);
  const map = new Map(load().projects.map((p) => [p.id, p]));
  incoming.forEach((p) => {
    const existing = map.get(p.id);
    if (!existing) {
      map.set(p.id, { ...p, name: uniqueName(p.name, p.id) });
      return;
    }
    const files = new Map(existing.files.map((f) => [f.path, f]));
    p.files.forEach((f) => {
      const cur = files.get(f.path);
      if (!cur || f.updatedAt >= cur.updatedAt) files.set(f.path, f);
    });
    map.set(p.id, { ...existing, files: sortFiles([...files.values()]), updatedAt: Math.max(existing.updatedAt, p.updatedAt) });
  });
  return commit([...map.values()]);
}

export function snapshotFiles() {
  return { projects: load().projects.map(stripProject) };
}

export function languageFromPath(path) {
  const ext = String(path).split('.').pop().toLowerCase();
  const map = {
    js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
    html: 'html', htm: 'html', css: 'css', scss: 'scss', json: 'json', md: 'markdown', py: 'python',
    sh: 'bash', yml: 'yaml', yaml: 'yaml', sql: 'sql', php: 'php', go: 'go', rs: 'rust', java: 'java',
    vue: 'vue', svg: 'xml', xml: 'xml', toml: 'toml', env: 'env', txt: 'text',
  };
  return map[ext] || ext || 'text';
}
