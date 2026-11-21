// marked (parse) → DOMPurify (sanitize) → highlight.js (kode).
// Blok kode dipisah dari HTML biasa supaya dirender sebagai komponen React
// (<CodeBlock/>: label file, scroll horizontal, tombol salin).

import { Marked } from 'marked';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/core';
import { extForLang, normalizePath, splitMultiFile } from './files';

import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import scss from 'highlight.js/lib/languages/scss';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import python from 'highlight.js/lib/languages/python';
import markdownLang from 'highlight.js/lib/languages/markdown';
import sql from 'highlight.js/lib/languages/sql';
import yaml from 'highlight.js/lib/languages/yaml';
import php from 'highlight.js/lib/languages/php';
import java from 'highlight.js/lib/languages/java';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import diff from 'highlight.js/lib/languages/diff';
import ini from 'highlight.js/lib/languages/ini';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('scss', scss);
hljs.registerLanguage('json', json);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('python', python);
hljs.registerLanguage('markdown', markdownLang);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('php', php);
hljs.registerLanguage('java', java);
hljs.registerLanguage('go', go);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('c', c);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('diff', diff);
hljs.registerLanguage('ini', ini);

const ALIASES = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  html: 'xml',
  htm: 'xml',
  vue: 'xml',
  svg: 'xml',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  console: 'bash',
  py: 'python',
  yml: 'yaml',
  md: 'markdown',
  'c++': 'cpp',
  env: 'ini',
  toml: 'ini',
  jsonc: 'json',
};

const marked = new Marked({ gfm: true, breaks: true });

// Link eksternal dibuka di tab baru; link internal (/coder) ditangani router.
if (typeof window !== 'undefined') {
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      const href = node.getAttribute('href') || '';
      if (/^https?:/i.test(href)) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    }
  });
}

export function sanitize(html) {
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function highlightHtml(code, lang) {
  const key = (lang || '').toLowerCase();
  const name = ALIASES[key] || key;
  if (name && hljs.getLanguage(name)) {
    try {
      return hljs.highlight(code, { language: name, ignoreIllegals: true }).value;
    } catch {
      /* jatuh ke plain */
    }
  }
  return escapeHtml(code);
}

// Baris pertama berupa komentar path → dipakai sebagai label nama file.
const FILE_COMMENT = /^(?:\/\/|#|--|\/\*|<!--)\s*(?:file(?:name)?:\s*)?([\w@.\\/-]+\.[A-Za-z0-9]+)\s*(?:\*\/|-->)?$/;

export function extractFilename(code, info = '') {
  const attr = info.match(/(?:title|file(?:name)?)\s*=\s*["']?([^"'\s}]+)/i);
  if (attr) return attr[1];
  const loose = info.trim().split(/\s+/).find((p) => /[./]/.test(p) && /\.[A-Za-z0-9]+$/.test(p));
  if (loose) return loose.replace(/^["'{[]+|["'}\]]+$/g, '');
  const first = String(code).split('\n', 1)[0].trim();
  const m = first.match(FILE_COMMENT);
  return m ? m[1] : '';
}

// Pecah markdown jadi [{type:'html', html} | {type:'code', code, lang, filename}]
export function toBlocks(text) {
  const tokens = marked.lexer(String(text || ''));
  const blocks = [];
  let buffer = [];
  const flush = () => {
    if (!buffer.length) return;
    const html = sanitize(marked.parser(buffer));
    if (html.trim()) blocks.push({ type: 'html', html });
    buffer = [];
  };
  for (const tok of tokens) {
    if (tok.type === 'code') {
      flush();
      const info = (tok.lang || '').trim();
      const lang = info.split(/\s+/)[0] || '';
      blocks.push({
        type: 'code',
        code: tok.text,
        lang: /^[\w+#.-]+$/.test(lang) && !/[./]\w+$/.test(lang) ? lang : '',
        filename: extractFilename(tok.text, info),
      });
    } else if (tok.type !== 'space') {
      buffer.push(tok);
    }
  }
  flush();
  return blocks;
}

export function containsCode(text) {
  return /```/.test(String(text || ''));
}

// Hapus semua fenced code block, sisakan prosa (untuk bubble Coder & riwayat).
export function stripCodeBlocks(text) {
  return marked.lexer(String(text || ''))
    .filter((token) => token.type !== 'code')
    .map((token) => token.raw)
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Semua file dari sebuah jawaban (untuk auto-save Coder/Terminal):
 *  - blok dengan komentar path dipecah per file,
 *  - blok dengan nama di info fence dipakai namanya,
 *  - blok polos disimpan sebagai snippet-N.<ext>.
 * Path duplikat: yang terakhir menang.
 */
export function extractCoderFiles(text) {
  const tokens = marked.lexer(String(text || ''));
  const map = new Map();
  let unnamed = 0;
  for (const tok of tokens) {
    if (tok.type !== 'code') continue;
    const info = (tok.lang || '').trim();
    const lang = info.split(/\s+/)[0] || '';
    const split = splitMultiFile(tok.text);
    if (split.length) {
      split.forEach((f) => map.set(f.path, f));
    } else {
      const fname = extractFilename(tok.text, info);
      const path = normalizePath(fname) || `snippet-${++unnamed}.${extForLang(lang)}`;
      map.set(path, { path, content: tok.text });
    }
  }
  return [...map.values()];
}
