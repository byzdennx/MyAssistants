import { useMemo, useState } from 'react';
import { Icon } from './icons';
import { Link } from '../router';
import { useT } from '../lib/i18n';
import { cx, relativeTime } from '../lib/utils';

// Daftar percakapan + pencarian (judul & isi). Bisa dilipat; di mobile jadi laci.
export default function ConversationSidebar({ mode, conversations, activeId, open, onClose, onNew, onDelete }) {
  const t = useT();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) => c.title.toLowerCase().includes(q) || c.messages.some((m) => m.content.toLowerCase().includes(q)),
    );
  }, [conversations, query]);

  if (!open) return null;

  return (
    <>
      <div className="fade-in absolute inset-0 z-20 bg-sepia/35 backdrop-blur-[2px] md:hidden" onClick={onClose} aria-hidden="true" />
      <aside
        aria-label={t('convo.sidebar')}
        className="fade-slide glass-hi absolute inset-y-0 left-0 z-30 flex w-[84vw] bg-paper/90 max-w-xs flex-col md:static md:z-auto md:w-72 md:max-w-none md:shrink-0 md:rounded-none md:border-y-0 md:border-l-0 md:border-r-rule md:bg-transparent md:shadow-none"
      >
        <div className="flex items-center gap-2 border-b border-rule p-3">
          <button type="button" className="btn btn-ink flex-1" onClick={onNew}>
            <Icon name="plus" size={14} />
            {t(mode === 'coder' ? 'convo.newCoder' : 'convo.newChat')}
          </button>
          <button type="button" className="icon-btn md:hidden" onClick={onClose} aria-label={t('common.close')}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="p-3 pb-2">
          <div className="relative">
            <Icon name="search" size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              type="search"
              className="field !py-1.5 !pl-8 !text-[0.82rem]"
              placeholder={t('convo.search')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={t('common.search')}
            />
          </div>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center font-serif text-sm italic text-ink-faint">
              {conversations.length === 0 ? t('convo.none') : t('convo.noMatch')}
            </p>
          ) : (
            <ul className="space-y-0.5">
              {filtered.map((c) => {
                const active = c.id === activeId;
                return (
                  <li key={c.id} className="group relative">
                    <Link
                      to={`/${mode}/${c.id}`}
                      onClick={() => window.matchMedia('(max-width: 767px)').matches && onClose()}
                      aria-current={active ? 'page' : undefined}
                      className={cx(
                        'block rounded-sm border-l-2 py-2 pl-3 pr-9 transition-colors duration-200',
                        active ? 'border-terracotta bg-ink/[0.07]' : 'border-transparent hover:bg-ink/[0.04]',
                      )}
                    >
                      <span className="block truncate font-serif text-[0.9rem] leading-snug text-ink">{c.title || t('convo.untitled')}</span>
                      <span className="mt-0.5 block text-[0.68rem] text-ink-faint">
                        {relativeTime(c.updatedAt, t.lang)} · {t('convo.count', { n: c.messages.length })}
                      </span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => onDelete(c)}
                      aria-label={`${t('convo.delete')}: ${c.title}`}
                      className="icon-btn absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 opacity-100 md:opacity-0 md:focus:opacity-100 md:group-hover:opacity-100"
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>

        <p className="hidden border-t border-rule px-4 py-3 font-serif text-[0.7rem] italic text-ink-faint md:block">
          Crafted with care by EpannXD · © 2026
        </p>
      </aside>
    </>
  );
}
