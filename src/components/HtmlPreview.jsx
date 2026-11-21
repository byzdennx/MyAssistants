import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './icons';
import { useT } from '../lib/i18n';
import { buildPreviewDoc, resolveRef } from '../lib/preview';

// Pratinjau HTML di iframe sandbox (tanpa akses ke data aplikasi). Ikut ter-update
// setiap file tersimpan. Hanya untuk layar lebar — File Manager di HP tidak menampilkannya.
export default function HtmlPreview({ files, entryPath, onEntryChange }) {
  const t = useT();
  const frame = useRef(null);
  const [nonce, setNonce] = useState(0);

  const htmlPaths = useMemo(() => files.map((f) => f.path).filter((p) => /\.html?$/i.test(p)), [files]);
  const built = useMemo(() => buildPreviewDoc({ files, entryPath }), [files, entryPath]);
  const doc = useDeferredValue(built.doc);

  // klik link lokal di dalam preview → pindah halaman bila file tujuannya ada
  useEffect(() => {
    const onMessage = (event) => {
      if (!frame.current || event.source !== frame.current.contentWindow) return;
      if (event.data?.type !== 'ma-preview-nav') return;
      const target = resolveRef(entryPath, String(event.data.href || ''));
      if (target && htmlPaths.includes(target)) onEntryChange(target);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [entryPath, htmlPaths, onEntryChange]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-rule px-3 py-2">
        <p className="eyebrow">{t('preview.title')}</p>
        <select
          className="field !w-auto !py-1 !text-[0.78rem] font-mono"
          value={entryPath}
          onChange={(e) => onEntryChange(e.target.value)}
          aria-label={t('preview.entry')}
        >
          {htmlPaths.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="icon-btn ml-auto"
          onClick={() => setNonce((n) => n + 1)}
          aria-label={t('preview.refresh')}
          title={t('preview.refresh')}
        >
          <Icon name="refresh" size={14} />
        </button>
      </div>

      {built.missing.length > 0 && (
        <p role="status" className="border-b border-rule px-3 py-1.5 font-serif text-[0.72rem] italic leading-relaxed text-accent">
          {t('preview.missing', { refs: built.missing.join(', ') })}
        </p>
      )}

      <iframe
        key={nonce}
        ref={frame}
        title={t('preview.title')}
        srcDoc={doc}
        sandbox="allow-scripts allow-forms allow-modals"
        className="min-h-0 flex-1 border-0 bg-white"
      />
    </div>
  );
}
