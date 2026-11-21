import { useEffect, useLayoutEffect, useRef } from 'react';
import { Icon } from './icons';
import QuotaPips from './QuotaPips';
import { useT } from '../lib/i18n';
import { useMediaQuery, useOnline, useQuota } from '../lib/hooks';
import { cx } from '../lib/utils';

// Kotak tulis: Enter kirim (non-touch), Shift+Enter baris baru, Ctrl/Cmd+Enter selalu kirim.
export default function Composer({ mode, value, onChange, onSend, disabled, busy, showSearch, needSearch, onToggleSearch }) {
  const t = useT();
  const online = useOnline();
  const quota = useQuota();
  const coarse = useMediaQuery('(pointer: coarse)');
  const ref = useRef(null);

  // tinggi mengikuti isi (maks 9 baris)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 216) + 'px';
  }, [value]);

  // Ctrl/Cmd+K → fokus ke kotak tulis
  useEffect(() => {
    const focus = () => ref.current?.focus();
    window.addEventListener('ma:focus-composer', focus);
    if (!coarse) focus();
    return () => window.removeEventListener('ma:focus-composer', focus);
  }, [coarse]);

  const canSend = online && !disabled && !busy && value.trim().length > 0;

  const onKeyDown = (e) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
    if (e.metaKey || e.ctrlKey || (!e.shiftKey && !coarse)) {
      e.preventDefault();
      if (canSend) onSend();
    }
  };

  return (
    <div className="glass-hi rounded-md p-2.5 transition-colors duration-200 focus-within:border-terracotta sm:p-3">
      <label htmlFor="composer" className="sr-only">
        {t('composer.label')}
      </label>
      <textarea
        id="composer"
        ref={ref}
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={t(mode === 'coder' ? 'composer.placeholder.coder' : 'composer.placeholder.chat')}
        className="composer-input block max-h-56 w-full resize-none border-0 bg-transparent px-2 py-1.5 text-[0.95rem] leading-relaxed text-ink outline-none placeholder:text-ink-faint"
      />
      <div className="mt-1.5 flex items-center gap-2 border-t border-rule pt-2.5">
        {showSearch && (
          <button
            type="button"
            onClick={onToggleSearch}
            aria-pressed={needSearch}
            className={cx(
              'inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 text-[0.72rem] transition-colors duration-200',
              needSearch ? 'border-ink bg-ink text-paper' : 'border-rule-strong text-ink-soft hover:text-ink',
            )}
          >
            <Icon name="globe" size={12} />
            {t('composer.web')}
          </button>
        )}
        <p className="hidden min-w-0 flex-1 truncate text-[0.7rem] text-ink-faint md:block">
          {coarse ? t('composer.hintCoarse') : t('composer.hint')} · <span className="kbd">Ctrl</span> <span className="kbd">Enter</span>
        </p>
        <span className="flex-1 md:hidden" />
        <span className="flex items-center gap-2 text-[0.7rem] text-ink-soft" title={t('quota.left', { n: quota.remaining, limit: quota.limit })}>
          <QuotaPips remaining={quota.remaining} limit={quota.limit} />
          <span className="font-mono tabular-nums">{quota.remaining}/{quota.limit}</span>
        </span>
        <button type="button" className="btn btn-ink" disabled={!canSend} onClick={onSend}>
          <Icon name="send" size={14} />
          {online ? t('composer.send') : t('composer.offline')}
        </button>
      </div>
    </div>
  );
}
