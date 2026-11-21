import { useEffect, useRef, useState } from 'react';
import { Icon } from './icons';
import { useT } from '../lib/i18n';
import { useToast } from './Toast';
import { exportConversationJson, exportConversationMarkdown } from '../lib/exportImport';

// Ekspor satu percakapan ke Markdown atau JSON.
export default function ExportMenu({ conversation, label, disabled }) {
  const t = useT();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const run = (kind) => {
    if (!conversation) return;
    if (kind === 'json') exportConversationJson(conversation);
    else exportConversationMarkdown(conversation, { youLabel: t('convo.you') });
    setOpen(false);
    toast({ kind: 'success', message: t('convo.exported'), duration: 2600 });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="btn btn-quiet"
        disabled={disabled || !conversation}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Icon name="download" size={14} />
        <span className="hidden sm:inline">{label || t('convo.export.label')}</span>
        <Icon name="chevron-down" size={12} className="hidden sm:block" />
      </button>
      {open && (
        <div role="menu" className="glass-hi fade-slide absolute right-0 top-full z-30 mt-1.5 w-48 rounded-md p-1">
          {[
            ['json', 'convo.export.json'],
            ['md', 'convo.export.md'],
          ].map(([kind, key]) => (
            <button
              key={kind}
              role="menuitem"
              type="button"
              onClick={() => run(kind)}
              className="block w-full rounded-sm px-3 py-2 text-left text-[0.82rem] text-ink-soft transition-colors duration-200 hover:bg-ink/10 hover:text-ink"
            >
              {t(key)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
