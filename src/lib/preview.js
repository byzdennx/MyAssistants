// Preview HTML: menggabungkan halaman HTML dengan CSS & JS lokal dari proyek.
//   <link rel="stylesheet" href="css/style.css"> → <style> berisi isi file itu
//   <script src="js/app.js"> → <script> berisi isi file itu (path relatif terhadap halaman)
// Link lokal ke halaman HTML lain dicegat dan dikirim ke parent (ganti halaman di preview).
// Berkas gambar/JSX tidak didukung; referensi yang tidak ada dilaporkan sebagai peringatan.

import { normalizePath } from './files';

const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;

// Path relatif terhadap halaman (fromPath) → path proyek. null kalau bukan berkas lokal.
export function resolveRef(fromPath, ref) {
  const raw = String(ref || '').trim();
  if (!raw || EXTERNAL.test(raw)) return null;
  const clean = raw.split('#')[0].split('?')[0];
  if (!clean) return null;
  const parts = clean.startsWith('/') ? [] : String(fromPath || '').split('/').slice(0, -1);
  for (const piece of clean.split('/')) {
    let seg = piece;
    try {
      seg = decodeURIComponent(piece);
    } catch {
      /* biarkan apa adanya */
    }
    if (!seg || seg === '.') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return normalizePath(parts.join('/')) || null;
}

// Cegat klik link lokal: kirim path ke parent. Link eksternal/anchor dibiarkan.
const NAV_SCRIPT =
  '<script>(function(){' +
  "document.addEventListener('click',function(e){" +
  "var a=e.target.closest&&e.target.closest('a[href]');if(!a)return;" +
  "var h=a.getAttribute('href')||'';" +
  "if(!h||/^(https?:|mailto:|tel:|javascript:|#|\\/\\/)/i.test(h))return;" +
  "e.preventDefault();parent.postMessage({type:'ma-preview-nav',href:h},'*');" +
  '},true);})();' +
  '<' +
  '/script>';

// Isi <style>/<script> tidak boleh memuat penutup tag sendiri.
const safeInline = (text, tag) => String(text).replace(new RegExp(`</(${tag})`, 'gi'), '<\\/$1');

export function buildPreviewDoc({ files, entryPath }) {
  const byPath = new Map(files.map((f) => [normalizePath(f.path), f.content]));
  if (!entryPath || !byPath.has(entryPath)) return { doc: '', missing: [] };

  const dom = new DOMParser().parseFromString(byPath.get(entryPath), 'text/html');
  const missing = [];

  dom.querySelectorAll('link[rel~="stylesheet"][href]').forEach((link) => {
    const ref = link.getAttribute('href');
    const target = resolveRef(entryPath, ref);
    if (!target) return;
    if (!byPath.has(target)) {
      missing.push(ref);
      return;
    }
    const style = dom.createElement('style');
    style.setAttribute('data-src', target);
    style.textContent = safeInline(byPath.get(target), 'style');
    link.replaceWith(style);
  });

  dom.querySelectorAll('script[src]').forEach((script) => {
    const ref = script.getAttribute('src');
    const target = resolveRef(entryPath, ref);
    if (!target) return;
    if (!byPath.has(target)) {
      missing.push(ref);
      return;
    }
    if (/\.(jsx|tsx|ts)$/i.test(target)) {
      missing.push(`${ref} (perlu build)`);
      return;
    }
    const inline = dom.createElement('script');
    if (script.type) inline.type = script.type;
    inline.setAttribute('data-src', target);
    inline.textContent = safeInline(byPath.get(target), 'script');
    script.replaceWith(inline);
  });

  dom.body.insertAdjacentHTML('beforeend', NAV_SCRIPT);
  return {
    doc: `<!doctype html>\n${dom.documentElement.outerHTML}`,
    missing: [...new Set(missing)],
  };
}
