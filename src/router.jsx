// Router custom berbasis History API (pushState / replaceState) — URL bersih tanpa "#".
//   navigate('/chat')            → history.pushState + re-render
//   popstate (tombol back/fwd)   → re-render
//   <A href="/chat">             → intercept klik, panggil navigate()
// Refresh di /chat atau /files butuh SPA fallback di server (lihat vercel.json).

import { useMemo, useSyncExternalStore } from 'react';

const listeners = new Set();

// Lokasi disimpan juga di memori: kalau pushState diblokir (mis. dibuka via file://),
// navigasi tetap jalan walau URL di address bar tidak berubah.
let current = readLocation();

function readLocation() {
  if (typeof window === 'undefined') return '/';
  return window.location.pathname + window.location.search;
}

function emit() {
  listeners.forEach((l) => l());
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    current = readLocation();
    emit();
  });
}

function subscribe(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const getSnapshot = () => current;

export function parseLocation(loc) {
  const [rawPath, query = ''] = String(loc || '/').split('?');
  // host statis kadang menyajikan /index.html — anggap sebagai beranda
  const path = rawPath.replace(/\/index\.html$/, '/') || '/';
  const segments = path
    .split('/')
    .filter(Boolean)
    .map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    });
  return {
    path: '/' + segments.join('/'),
    segments,
    query: Object.fromEntries(new URLSearchParams(query)),
  };
}

export function useRoute() {
  const loc = useSyncExternalStore(subscribe, getSnapshot, () => '/');
  return useMemo(() => parseLocation(loc), [loc]);
}

export function navigate(to, { replace = false } = {}) {
  const target = to.startsWith('/') ? to : '/' + to;
  if (target === current) return;
  try {
    if (replace) window.history.replaceState({}, '', target);
    else window.history.pushState({}, '', target);
  } catch {
    /* pushState diblokir — tetap navigasi di memori */
  }
  current = target;
  emit();
}

// Link internal: klik biasa → navigate(); Ctrl/Cmd/Shift/klik tengah → biarkan browser.
export function A({ href, onClick, target, children, ...rest }) {
  const handle = (e) => {
    onClick?.(e);
    if (e.defaultPrevented) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (target && target !== '_self') return;
    if (!href || !href.startsWith('/') || href.startsWith('//')) return;
    e.preventDefault();
    navigate(href);
  };
  return (
    <a href={href} onClick={handle} target={target} {...rest}>
      {children}
    </a>
  );
}

// alias lama: <Link to="/chat">
export function Link({ to, ...rest }) {
  return <A href={to} {...rest} />;
}

// Untuk HTML hasil markdown: delegasikan klik link internal ke router.
export function interceptInternalLink(e) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest?.('a');
  if (!a) return;
  const href = a.getAttribute('href') || '';
  if (!href.startsWith('/') || href.startsWith('//') || a.target === '_blank') return;
  e.preventDefault();
  navigate(href);
}
